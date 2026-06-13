// Package watcher watches worktree directories for filesystem changes and
// publishes git-status + file-tree SSE topics so the UI refreshes without
// waiting on the 30-second polling fallback.
package watcher

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"

	"github.com/blaisetiong/workbench-cli/server-go/internal/events"
)

// Two-tier debounce. A working-tree write affects both git status and the file
// listing, but they have very different refetch costs and urgencies:
//
//   - git-status / worktrees: cheap and latency-sensitive — the user wants the
//     diff panel to feel live. Debounced on the short interval.
//   - file-tree: the file listing is the worktree's entire path set (tens of KB)
//     and only actually changes on add/remove/rename, never on a content edit.
//     Refetching it on every keystroke-save is the dominant cost when an agent
//     edits continuously, so it gets a much longer debounce. A 1-3s lag before a
//     newly-created file shows up in the tree is imperceptible next to the
//     bandwidth/CPU saved.
//
// Both are trailing debounces: a burst collapses into one publish after writes
// settle. The 30s client poll / refetch-on-focus is the correctness fallback.
const (
	defaultStatusDebounce = 1 * time.Second
	defaultTreeDebounce   = 2500 * time.Millisecond
)

// skipDirs are directory base names that are never watched: either high-churn
// noise or huge trees that would exhaust file descriptors. ".git" itself is
// intentionally watched (for index/HEAD), but its "objects" subtree is skipped.
var skipDirs = map[string]bool{
	"node_modules": true,
	"objects":      true, // .git/objects
	"dist":         true,
	"build":        true,
	"out":          true,
	"target":       true,
	"vendor":       true,
	"venv":         true,
	".venv":        true,
	"__pycache__":  true,
	".cache":       true,
	".next":        true,
	".nuxt":        true,
	".turbo":       true,
	"coverage":     true,
}

func skip(name string) bool { return skipDirs[name] }

// classify decides which SSE topics an event for absPath should publish.
//
// Working-tree changes (anything outside .git) affect both the file listing and
// git status, so they publish both. Changes inside .git are git-only at most —
// the file listing never includes .git — and most .git churn is pure noise that
// must NOT trigger a refetch, or the panel's own git activity (and any agent's)
// drives a publish storm. Only meaningful state transitions (HEAD/refs/index)
// publish git-status; lock files, reflogs, loose objects and scratch files are
// ignored entirely. Add/remove of a linked worktree (a directory directly under
// .git/worktrees) publishes the worktrees topic so the sidebar reflects
// `git worktree add`/`remove` typed in a terminal without polling.
func classify(repoPath, absPath string) (fileTree, gitStatus, worktrees bool) {
	rel, err := filepath.Rel(repoPath, absPath)
	if err != nil {
		return true, true, false // unknown location: refresh conservatively
	}
	rel = filepath.ToSlash(rel)
	if rel != ".git" && !strings.HasPrefix(rel, ".git/") {
		return true, true, false // working-tree change
	}
	sub := strings.TrimPrefix(rel, ".git/")
	if isWorktreeListChange(sub) {
		return false, false, true
	}
	return false, gitStateRelevant(sub), false
}

// isGitInternal reports whether absPath is the .git directory itself or any
// path inside it.
func isGitInternal(repoPath, absPath string) bool {
	rel, err := filepath.Rel(repoPath, absPath)
	if err != nil {
		return false
	}
	rel = filepath.ToSlash(rel)
	return rel == ".git" || strings.HasPrefix(rel, ".git/")
}

// isWorktreeListChange reports whether sub (a path relative to .git) is the
// creation/removal of a linked worktree entry rather than churn inside one.
// git stores each linked worktree as .git/worktrees/<name>/; the directory
// appearing or disappearing means the worktree set changed. Deeper paths
// (.git/worktrees/<name>/HEAD, index, …) are that worktree's own git churn and
// must not spam the worktrees list.
func isWorktreeListChange(sub string) bool {
	if sub == "worktrees" {
		return true // the parent dir itself appearing (first linked worktree)
	}
	name, ok := strings.CutPrefix(sub, "worktrees/")
	return ok && name != "" && !strings.Contains(name, "/")
}

// gitStateRelevant reports whether a path inside .git (given relative to .git)
// reflects a status-affecting state change rather than transient bookkeeping.
func gitStateRelevant(sub string) bool {
	if strings.HasSuffix(sub, ".lock") {
		return false // index.lock, refs/**/*.lock — written on every git operation
	}
	switch sub {
	case "HEAD", "ORIG_HEAD", "MERGE_HEAD", "index", "packed-refs":
		return true
	}
	// Branch/tag refs move on commit, checkout, reset, merge.
	if strings.HasPrefix(sub, "refs/") {
		return true
	}
	// Everything else is noise: logs/ (reflogs), objects/, COMMIT_EDITMSG,
	// FETCH_HEAD, config, hooks/, scratch files, etc.
	return false
}

// WorktreeWatcher maintains one fsnotify watcher per worktree.
type WorktreeWatcher struct {
	bus            *events.Bus
	statusDebounce time.Duration
	treeDebounce   time.Duration
	mu             sync.Mutex
	handles        map[string]*handle
}

type handle struct {
	fsw      *fsnotify.Watcher
	done     chan struct{}
	repoPath string

	timerMu          sync.Mutex
	statusTimer      *time.Timer // git-status + worktrees (short debounce)
	treeTimer        *time.Timer // file-tree (long debounce)
	pendingFileTree  bool
	pendingGitStatus bool
	pendingWorktrees bool
}

// New creates a watcher that publishes to the given bus.
func New(bus *events.Bus) *WorktreeWatcher {
	return newWithDebounce(bus, defaultStatusDebounce, defaultTreeDebounce)
}

// newWithDebounce builds a watcher with explicit debounce intervals; tests use
// short ones to stay fast and deterministic.
func newWithDebounce(bus *events.Bus, status, tree time.Duration) *WorktreeWatcher {
	return &WorktreeWatcher{
		bus:            bus,
		statusDebounce: status,
		treeDebounce:   tree,
		handles:        map[string]*handle{},
	}
}

// Watch begins watching repoPath (recursively) for the given worktree id.
// Calling Watch for an id that is already watched is a no-op.
func (w *WorktreeWatcher) Watch(id, repoPath string) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if _, ok := w.handles[id]; ok {
		return nil
	}
	fsw, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}
	addDirsRecursive(fsw, repoPath)
	h := &handle{fsw: fsw, done: make(chan struct{}), repoPath: repoPath}
	w.handles[id] = h
	go w.loop(id, h)
	return nil
}

// Unwatch stops watching the given worktree id and releases its resources.
func (w *WorktreeWatcher) Unwatch(id string) {
	w.mu.Lock()
	h, ok := w.handles[id]
	if ok {
		delete(w.handles, id)
	}
	w.mu.Unlock()
	if !ok {
		return
	}
	close(h.done)
	_ = h.fsw.Close()
	h.timerMu.Lock()
	if h.statusTimer != nil {
		h.statusTimer.Stop()
	}
	if h.treeTimer != nil {
		h.treeTimer.Stop()
	}
	h.timerMu.Unlock()
}

// Close tears down all watchers. Safe to call on shutdown.
func (w *WorktreeWatcher) Close() {
	w.mu.Lock()
	ids := make([]string, 0, len(w.handles))
	for id := range w.handles {
		ids = append(ids, id)
	}
	w.mu.Unlock()
	for _, id := range ids {
		w.Unwatch(id)
	}
}

func (w *WorktreeWatcher) loop(id string, h *handle) {
	for {
		select {
		case <-h.done:
			return
		case event, ok := <-h.fsw.Events:
			if !ok {
				return
			}
			// Pick up directories created after the initial walk so new
			// subtrees (e.g. an agent scaffolding a folder) are watched too.
			if event.Op&fsnotify.Create == fsnotify.Create {
				if fi, err := os.Stat(event.Name); err == nil && fi.IsDir() && !skip(filepath.Base(event.Name)) {
					addDirsRecursive(h.fsw, event.Name)
				}
			}
			// A lone CHMOD inside .git is metadata noise, not a state change.
			// Read-only git commands (status/diff) touch .git/index's metadata on
			// every panel refetch; GIT_OPTIONAL_LOCKS=0 stops the content rewrite
			// but not this attribute touch, which fsnotify still reports as CHMOD.
			// Publishing on it feeds the panel's own refetch straight back into a
			// refetch and spins forever. Real index/ref updates arrive as writes or
			// renames (git writes a .lock then renames it into place), so dropping
			// the lone chmod loses no actual state change. Working-tree chmods
			// (e.g. chmod +x on a tracked file) are outside .git and still publish.
			if event.Op == fsnotify.Chmod && isGitInternal(h.repoPath, event.Name) {
				continue
			}
			fileTree, gitStatus, worktrees := classify(h.repoPath, event.Name)
			if !fileTree && !gitStatus && !worktrees {
				continue // .git bookkeeping noise — would otherwise storm the panel
			}
			w.schedulePublish(id, h, fileTree, gitStatus, worktrees)
		case _, ok := <-h.fsw.Errors:
			if !ok {
				return
			}
		}
	}
}

// schedulePublish arms the relevant debounce timer(s). git-status and worktrees
// share the short timer; file-tree gets the long one, so a burst of content edits
// stops hammering the (large) file-listing refetch without slowing the diff panel.
func (w *WorktreeWatcher) schedulePublish(id string, h *handle, fileTree, gitStatus, worktrees bool) {
	h.timerMu.Lock()
	defer h.timerMu.Unlock()
	if gitStatus || worktrees {
		h.pendingGitStatus = h.pendingGitStatus || gitStatus
		h.pendingWorktrees = h.pendingWorktrees || worktrees
		if h.statusTimer == nil {
			h.statusTimer = time.AfterFunc(w.statusDebounce, func() { w.publishStatus(id, h) })
		} else {
			h.statusTimer.Reset(w.statusDebounce)
		}
	}
	if fileTree {
		h.pendingFileTree = true
		if h.treeTimer == nil {
			h.treeTimer = time.AfterFunc(w.treeDebounce, func() { w.publishTree(id, h) })
		} else {
			h.treeTimer.Reset(w.treeDebounce)
		}
	}
}

// publishStatus emits the worktrees + git-status topics on the short debounce.
func (w *WorktreeWatcher) publishStatus(id string, h *handle) {
	h.timerMu.Lock()
	gitStatus, worktrees := h.pendingGitStatus, h.pendingWorktrees
	h.pendingGitStatus, h.pendingWorktrees = false, false
	h.timerMu.Unlock()

	if w.bus == nil || (!gitStatus && !worktrees) {
		return
	}
	// worktrees first (set membership), then git-status (cheap).
	topics := make([]string, 0, 2)
	if worktrees {
		topics = append(topics, "worktrees")
	}
	if gitStatus {
		topics = append(topics, "git-status:"+id)
	}
	w.bus.Publish(topics...)
}

// publishTree emits the file-tree topic on the long debounce.
func (w *WorktreeWatcher) publishTree(id string, h *handle) {
	h.timerMu.Lock()
	fileTree := h.pendingFileTree
	h.pendingFileTree = false
	h.timerMu.Unlock()

	if w.bus == nil || !fileTree {
		return
	}
	w.bus.Publish("file-tree:" + id)
}

// addDirsRecursive walks root and adds a watch for each directory, skipping
// noise/huge trees. Errors are ignored so a transient unreadable dir doesn't
// abort watching the rest of the tree.
func addDirsRecursive(fsw *fsnotify.Watcher, root string) {
	_ = filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if !d.IsDir() {
			return nil
		}
		if path != root && skip(d.Name()) {
			return filepath.SkipDir
		}
		_ = fsw.Add(path)
		return nil
	})
}

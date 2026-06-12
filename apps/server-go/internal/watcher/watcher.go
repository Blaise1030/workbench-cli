// Package watcher watches worktree directories for filesystem changes and
// publishes git-status + file-tree SSE topics so the UI refreshes without
// waiting on the 30-second polling fallback.
package watcher

import (
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"

	"github.com/blaisetiong/workbench-cli/server-go/internal/events"
)

// debounceInterval collapses bursts of writes (e.g. an agent saving many files,
// or a multi-step git operation) into a single publish. It is deliberately
// generous: a busy worktree (an agent actively editing + running git) would
// otherwise emit a publish every ~100ms, and each publish fans out on the client
// to a git-status + several diff refetches. The 30s poll is the correctness
// fallback, so push latency here only affects how snappy the panel feels.
const debounceInterval = 400 * time.Millisecond

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
	bus     *events.Bus
	mu      sync.Mutex
	handles map[string]*handle
}

type handle struct {
	fsw      *fsnotify.Watcher
	done     chan struct{}
	repoPath string

	timerMu          sync.Mutex
	timer            *time.Timer
	pendingFileTree  bool
	pendingGitStatus bool
	pendingWorktrees bool
}

// New creates a watcher that publishes to the given bus.
func New(bus *events.Bus) *WorktreeWatcher {
	return &WorktreeWatcher{bus: bus, handles: map[string]*handle{}}
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
	if h.timer != nil {
		h.timer.Stop()
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

func (w *WorktreeWatcher) schedulePublish(id string, h *handle, fileTree, gitStatus, worktrees bool) {
	h.timerMu.Lock()
	defer h.timerMu.Unlock()
	h.pendingFileTree = h.pendingFileTree || fileTree
	h.pendingGitStatus = h.pendingGitStatus || gitStatus
	h.pendingWorktrees = h.pendingWorktrees || worktrees
	if h.timer == nil {
		h.timer = time.AfterFunc(debounceInterval, func() { w.publish(id, h) })
		return
	}
	h.timer.Reset(debounceInterval)
}

func (w *WorktreeWatcher) publish(id string, h *handle) {
	h.timerMu.Lock()
	fileTree, gitStatus, worktrees := h.pendingFileTree, h.pendingGitStatus, h.pendingWorktrees
	h.pendingFileTree, h.pendingGitStatus, h.pendingWorktrees = false, false, false
	h.timerMu.Unlock()

	if w.bus == nil || (!fileTree && !gitStatus && !worktrees) {
		return
	}
	// worktrees first (set membership), then git-status (cheap), then file-tree.
	// A file-tree change always implies a status change too.
	topics := make([]string, 0, 3)
	if worktrees {
		topics = append(topics, "worktrees")
	}
	if gitStatus {
		topics = append(topics, "git-status:"+id)
	}
	if fileTree {
		topics = append(topics, "file-tree:"+id)
	}
	data, _ := json.Marshal(map[string][]string{"topics": topics})
	w.bus.Publish(string(data))
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

// Package watcher watches worktree directories for filesystem changes and
// publishes git-status + file-tree SSE topics so the UI refreshes without
// waiting on the 30-second polling fallback.
package watcher

import (
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"

	"github.com/blaisetiong/workbench-cli/server-go/internal/events"
)

// debounceInterval collapses bursts of writes (e.g. an agent saving many files,
// or git writing index.lock then renaming to index) into a single publish.
const debounceInterval = 100 * time.Millisecond

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

// WorktreeWatcher maintains one fsnotify watcher per worktree.
type WorktreeWatcher struct {
	bus      *events.Bus
	mu       sync.Mutex
	handles  map[string]*handle
}

type handle struct {
	fsw  *fsnotify.Watcher
	done chan struct{}

	timerMu sync.Mutex
	timer   *time.Timer
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
	h := &handle{fsw: fsw, done: make(chan struct{})}
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
			w.schedulePublish(id, h)
		case _, ok := <-h.fsw.Errors:
			if !ok {
				return
			}
		}
	}
}

func (w *WorktreeWatcher) schedulePublish(id string, h *handle) {
	h.timerMu.Lock()
	defer h.timerMu.Unlock()
	if h.timer == nil {
		h.timer = time.AfterFunc(debounceInterval, func() { w.publish(id) })
		return
	}
	h.timer.Reset(debounceInterval)
}

func (w *WorktreeWatcher) publish(id string) {
	if w.bus == nil {
		return
	}
	data, _ := json.Marshal(map[string][]string{
		"topics": {"git-status:" + id, "file-tree:" + id},
	})
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

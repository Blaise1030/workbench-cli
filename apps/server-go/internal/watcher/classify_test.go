package watcher

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/blaisetiong/workbench-cli/server-go/internal/events"
)

// expectNoMessage fails if a bus message arrives within d.
func expectNoMessage(t *testing.T, sub *events.Subscriber, d time.Duration) {
	t.Helper()
	select {
	case msg := <-sub.C:
		t.Fatalf("unexpected notification: %q", msg)
	case <-time.After(d):
	}
}

// initGitDir creates a minimal .git layout that is watched from the start.
func initGitDir(t *testing.T, dir string) {
	t.Helper()
	for _, d := range []string{".git", ".git/refs/heads", ".git/logs"} {
		if err := os.MkdirAll(filepath.Join(dir, d), 0o755); err != nil {
			t.Fatalf("mkdir %s: %v", d, err)
		}
	}
	if err := os.WriteFile(filepath.Join(dir, ".git/HEAD"), []byte("ref: refs/heads/main\n"), 0o644); err != nil {
		t.Fatalf("write HEAD: %v", err)
	}
}

func TestGitInternalNoiseIgnored(t *testing.T) {
	dir := t.TempDir()
	initGitDir(t, dir)

	bus := events.NewBus()
	ch := bus.Subscribe(map[string]bool{"wt1": true})
	w := newWithDebounce(bus, testStatusDebounce, testTreeDebounce)
	if err := w.Watch("wt1", dir); err != nil {
		t.Fatalf("Watch: %v", err)
	}
	defer w.Close()
	time.Sleep(80 * time.Millisecond)

	// index.lock churn (every git write) and reflog appends must not refetch.
	if err := os.WriteFile(filepath.Join(dir, ".git/index.lock"), []byte("x"), 0o644); err != nil {
		t.Fatalf("write index.lock: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, ".git/logs/HEAD"), []byte("log\n"), 0o644); err != nil {
		t.Fatalf("write logs/HEAD: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, ".git/COMMIT_EDITMSG"), []byte("msg"), 0o644); err != nil {
		t.Fatalf("write COMMIT_EDITMSG: %v", err)
	}
	expectNoMessage(t, ch, 500*time.Millisecond)
}

func TestGitStateChangePublishesStatusOnly(t *testing.T) {
	dir := t.TempDir()
	initGitDir(t, dir)

	bus := events.NewBus()
	ch := bus.Subscribe(map[string]bool{"wt1": true})
	w := newWithDebounce(bus, testStatusDebounce, testTreeDebounce)
	if err := w.Watch("wt1", dir); err != nil {
		t.Fatalf("Watch: %v", err)
	}
	defer w.Close()
	time.Sleep(80 * time.Millisecond)

	// External `git add` updates the index: status changes, file list does not.
	if err := os.WriteFile(filepath.Join(dir, ".git/index"), []byte("idx"), 0o644); err != nil {
		t.Fatalf("write index: %v", err)
	}
	msg := waitForMessage(t, ch, 2*time.Second)
	if !strings.Contains(msg, "git-status:wt1") {
		t.Fatalf("expected git-status topic, got: %q", msg)
	}
	if strings.Contains(msg, "file-tree:wt1") {
		t.Fatalf("git-only change should not refetch the file tree, got: %q", msg)
	}
}

func TestGitIndexChmodIgnored(t *testing.T) {
	dir := t.TempDir()
	initGitDir(t, dir)
	// The index must already exist so chmod-ing it emits a bare CHMOD (not CREATE).
	if err := os.WriteFile(filepath.Join(dir, ".git/index"), []byte("idx"), 0o644); err != nil {
		t.Fatalf("write index: %v", err)
	}

	bus := events.NewBus()
	ch := bus.Subscribe(map[string]bool{"wt1": true})
	w := newWithDebounce(bus, testStatusDebounce, testTreeDebounce)
	if err := w.Watch("wt1", dir); err != nil {
		t.Fatalf("Watch: %v", err)
	}
	defer w.Close()
	time.Sleep(80 * time.Millisecond)

	// Read-only git commands (status/diff, run on every panel refetch) touch the
	// index's metadata, which fsnotify reports as a bare CHMOD. Publishing on it
	// feeds back into the panel's own refetch and spins forever. A real index
	// update arrives as a write/rename, not a lone chmod.
	if err := os.Chmod(filepath.Join(dir, ".git/index"), 0o600); err != nil {
		t.Fatalf("chmod index: %v", err)
	}
	expectNoMessage(t, ch, 700*time.Millisecond)
}

func TestGitIndexRenamePublishesStatus(t *testing.T) {
	dir := t.TempDir()
	initGitDir(t, dir)
	if err := os.WriteFile(filepath.Join(dir, ".git/index"), []byte("old"), 0o644); err != nil {
		t.Fatalf("write index: %v", err)
	}

	bus := events.NewBus()
	ch := bus.Subscribe(map[string]bool{"wt1": true})
	w := newWithDebounce(bus, testStatusDebounce, testTreeDebounce)
	if err := w.Watch("wt1", dir); err != nil {
		t.Fatalf("Watch: %v", err)
	}
	defer w.Close()
	time.Sleep(80 * time.Millisecond)

	// A real `git add`/commit writes a temp lock then renames it onto .git/index
	// atomically. That arrives as a create/rename — NOT a lone chmod — so dropping
	// chmod echoes (TestGitIndexChmodIgnored) must not suppress this real update.
	lock := filepath.Join(dir, ".git/index.lock")
	if err := os.WriteFile(lock, []byte("new"), 0o644); err != nil {
		t.Fatalf("write index.lock: %v", err)
	}
	if err := os.Rename(lock, filepath.Join(dir, ".git/index")); err != nil {
		t.Fatalf("rename onto index: %v", err)
	}
	msg := waitForMessage(t, ch, 2*time.Second)
	if !strings.Contains(msg, "git-status:wt1") {
		t.Fatalf("expected git-status topic after index rename, got: %q", msg)
	}
}

func TestRefChangePublishesStatusOnly(t *testing.T) {
	dir := t.TempDir()
	initGitDir(t, dir)

	bus := events.NewBus()
	ch := bus.Subscribe(map[string]bool{"wt1": true})
	w := newWithDebounce(bus, testStatusDebounce, testTreeDebounce)
	if err := w.Watch("wt1", dir); err != nil {
		t.Fatalf("Watch: %v", err)
	}
	defer w.Close()
	time.Sleep(80 * time.Millisecond)

	// A commit/branch move updates refs/heads/*: status changes, file list does not.
	if err := os.WriteFile(filepath.Join(dir, ".git/refs/heads/main"), []byte("abc123\n"), 0o644); err != nil {
		t.Fatalf("write ref: %v", err)
	}
	msg := waitForMessage(t, ch, 2*time.Second)
	if !strings.Contains(msg, "git-status:wt1") {
		t.Fatalf("expected git-status topic, got: %q", msg)
	}
	if strings.Contains(msg, "file-tree:wt1") {
		t.Fatalf("ref change should not refetch the file tree, got: %q", msg)
	}
}

func TestLinkedWorktreeAddPublishesWorktrees(t *testing.T) {
	dir := t.TempDir()
	initGitDir(t, dir)
	if err := os.MkdirAll(filepath.Join(dir, ".git/worktrees"), 0o755); err != nil {
		t.Fatalf("mkdir worktrees: %v", err)
	}

	bus := events.NewBus()
	ch := bus.Subscribe(map[string]bool{"wt1": true})
	w := newWithDebounce(bus, testStatusDebounce, testTreeDebounce)
	if err := w.Watch("wt1", dir); err != nil {
		t.Fatalf("Watch: %v", err)
	}
	defer w.Close()
	time.Sleep(80 * time.Millisecond)

	// `git worktree add` creates .git/worktrees/<name>/.
	if err := os.Mkdir(filepath.Join(dir, ".git/worktrees/feature"), 0o755); err != nil {
		t.Fatalf("mkdir linked worktree: %v", err)
	}
	msg := waitForMessage(t, ch, 2*time.Second)
	if !strings.Contains(msg, "\"worktrees\"") {
		t.Fatalf("expected worktrees topic, got: %q", msg)
	}
	if strings.Contains(msg, "file-tree:wt1") {
		t.Fatalf("worktree add should not refetch the main tree, got: %q", msg)
	}
}

func TestLinkedWorktreeInternalChurnIgnored(t *testing.T) {
	dir := t.TempDir()
	initGitDir(t, dir)
	if err := os.MkdirAll(filepath.Join(dir, ".git/worktrees/feature"), 0o755); err != nil {
		t.Fatalf("mkdir linked worktree: %v", err)
	}

	bus := events.NewBus()
	ch := bus.Subscribe(map[string]bool{"wt1": true})
	w := newWithDebounce(bus, testStatusDebounce, testTreeDebounce)
	if err := w.Watch("wt1", dir); err != nil {
		t.Fatalf("Watch: %v", err)
	}
	defer w.Close()
	time.Sleep(80 * time.Millisecond)

	// Operating inside a linked worktree churns its per-worktree HEAD/index;
	// the worktree *set* did not change, so it must not publish worktrees.
	if err := os.WriteFile(filepath.Join(dir, ".git/worktrees/feature/HEAD"), []byte("ref\n"), 0o644); err != nil {
		t.Fatalf("write linked HEAD: %v", err)
	}
	expectNoMessage(t, ch, 700*time.Millisecond)
}

func TestRefLockIgnored(t *testing.T) {
	dir := t.TempDir()
	initGitDir(t, dir)

	bus := events.NewBus()
	ch := bus.Subscribe(map[string]bool{"wt1": true})
	w := newWithDebounce(bus, testStatusDebounce, testTreeDebounce)
	if err := w.Watch("wt1", dir); err != nil {
		t.Fatalf("Watch: %v", err)
	}
	defer w.Close()
	time.Sleep(80 * time.Millisecond)

	// Lock files under refs/ are transient noise, not a state change.
	if err := os.WriteFile(filepath.Join(dir, ".git/refs/heads/main.lock"), []byte("x"), 0o644); err != nil {
		t.Fatalf("write ref lock: %v", err)
	}
	expectNoMessage(t, ch, 500*time.Millisecond)
}

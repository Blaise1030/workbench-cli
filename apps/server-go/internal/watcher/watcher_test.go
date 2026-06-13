package watcher

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/blaisetiong/workbench-cli/server-go/internal/events"
)

// Short debounce intervals keep tests fast and deterministic while preserving the
// status-before-tree ordering the production defaults produce.
const (
	testStatusDebounce = 40 * time.Millisecond
	testTreeDebounce   = 150 * time.Millisecond
)

// waitForMessage returns the next bus message or fails after timeout.
func waitForMessage(t *testing.T, sub *events.Subscriber, timeout time.Duration) string {
	t.Helper()
	select {
	case msg := <-sub.C:
		return msg
	case <-time.After(timeout):
		t.Fatalf("timed out waiting for bus message")
		return ""
	}
}

// waitForTopic reads messages until one contains substr (topics now arrive split
// across separate publishes), failing after timeout.
func waitForTopic(t *testing.T, sub *events.Subscriber, substr string, timeout time.Duration) string {
	t.Helper()
	deadline := time.After(timeout)
	for {
		select {
		case msg := <-sub.C:
			if strings.Contains(msg, substr) {
				return msg
			}
		case <-deadline:
			t.Fatalf("timed out waiting for topic %q", substr)
			return ""
		}
	}
}

func TestWatchPublishesOnFileCreate(t *testing.T) {
	dir := t.TempDir()
	bus := events.NewBus()
	ch := bus.Subscribe(map[string]bool{"wt1": true})

	w := newWithDebounce(bus, testStatusDebounce, testTreeDebounce)
	if err := w.Watch("wt1", dir); err != nil {
		t.Fatalf("Watch: %v", err)
	}
	defer w.Close()
	time.Sleep(50 * time.Millisecond) // let the watch goroutine start

	if err := os.WriteFile(filepath.Join(dir, "hello.txt"), []byte("hi"), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}

	// git-status publishes first on the short debounce, without the file-tree topic.
	first := waitForMessage(t, ch, 2*time.Second)
	if !strings.Contains(first, "git-status:wt1") {
		t.Fatalf("expected git-status first, got: %q", first)
	}
	if strings.Contains(first, "file-tree:wt1") {
		t.Fatalf("file-tree must not ride the fast status publish, got: %q", first)
	}
	// file-tree follows on the longer debounce.
	if msg := waitForTopic(t, ch, "file-tree:wt1", 2*time.Second); msg == "" {
		t.Fatal("expected a file-tree publish on the long debounce")
	}
}

func TestWatchPicksUpNewSubdirectories(t *testing.T) {
	dir := t.TempDir()
	bus := events.NewBus()
	ch := bus.Subscribe(map[string]bool{"wt1": true})

	w := newWithDebounce(bus, testStatusDebounce, testTreeDebounce)
	if err := w.Watch("wt1", dir); err != nil {
		t.Fatalf("Watch: %v", err)
	}
	defer w.Close()
	time.Sleep(50 * time.Millisecond)

	sub := filepath.Join(dir, "pkg")
	if err := os.Mkdir(sub, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	// drain the file-tree publish for the mkdir itself
	waitForTopic(t, ch, "file-tree:wt1", 2*time.Second)

	if err := os.WriteFile(filepath.Join(sub, "a.txt"), []byte("x"), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}
	// a write inside the newly-created dir is detected only if pkg got watched.
	waitForTopic(t, ch, "file-tree:wt1", 2*time.Second)
}

func TestSkippedDirsDoNotNotify(t *testing.T) {
	dir := t.TempDir()
	nm := filepath.Join(dir, "node_modules")
	if err := os.Mkdir(nm, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}

	bus := events.NewBus()
	ch := bus.Subscribe(map[string]bool{"wt1": true})
	w := newWithDebounce(bus, testStatusDebounce, testTreeDebounce)
	if err := w.Watch("wt1", dir); err != nil {
		t.Fatalf("Watch: %v", err)
	}
	defer w.Close()
	time.Sleep(50 * time.Millisecond)

	if err := os.WriteFile(filepath.Join(nm, "dep.js"), []byte("x"), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}

	select {
	case msg := <-ch.C:
		t.Fatalf("unexpected notification for node_modules write: %q", msg)
	case <-time.After(400 * time.Millisecond):
		// expected: no event
	}
}

func TestUnwatchStopsNotifications(t *testing.T) {
	dir := t.TempDir()
	bus := events.NewBus()
	ch := bus.Subscribe(map[string]bool{"wt1": true})
	w := newWithDebounce(bus, testStatusDebounce, testTreeDebounce)
	if err := w.Watch("wt1", dir); err != nil {
		t.Fatalf("Watch: %v", err)
	}
	time.Sleep(50 * time.Millisecond)
	w.Unwatch("wt1")
	time.Sleep(50 * time.Millisecond)

	if err := os.WriteFile(filepath.Join(dir, "after.txt"), []byte("x"), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}
	select {
	case msg := <-ch.C:
		t.Fatalf("unexpected notification after Unwatch: %q", msg)
	case <-time.After(400 * time.Millisecond):
		// expected: no event
	}
}

package watcher

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/blaisetiong/workbench-cli/server-go/internal/events"
)

// waitForMessage returns the next bus message or fails after timeout.
func waitForMessage(t *testing.T, ch chan string, timeout time.Duration) string {
	t.Helper()
	select {
	case msg := <-ch:
		return msg
	case <-time.After(timeout):
		t.Fatalf("timed out waiting for bus message")
		return ""
	}
}

func TestWatchPublishesOnFileCreate(t *testing.T) {
	dir := t.TempDir()
	bus := events.NewBus()
	ch := bus.Subscribe()

	w := New(bus)
	if err := w.Watch("wt1", dir); err != nil {
		t.Fatalf("Watch: %v", err)
	}
	defer w.Close()
	time.Sleep(50 * time.Millisecond) // let the watch goroutine start

	if err := os.WriteFile(filepath.Join(dir, "hello.txt"), []byte("hi"), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}

	msg := waitForMessage(t, ch, 2*time.Second)
	if !strings.Contains(msg, "git-status:wt1") || !strings.Contains(msg, "file-tree:wt1") {
		t.Fatalf("message missing expected topics: %q", msg)
	}
}

func TestWatchPicksUpNewSubdirectories(t *testing.T) {
	dir := t.TempDir()
	bus := events.NewBus()
	ch := bus.Subscribe()

	w := New(bus)
	if err := w.Watch("wt1", dir); err != nil {
		t.Fatalf("Watch: %v", err)
	}
	defer w.Close()
	time.Sleep(50 * time.Millisecond)

	sub := filepath.Join(dir, "pkg")
	if err := os.Mkdir(sub, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	// drain the event for the mkdir itself
	waitForMessage(t, ch, 2*time.Second)

	if err := os.WriteFile(filepath.Join(sub, "a.txt"), []byte("x"), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}
	msg := waitForMessage(t, ch, 2*time.Second)
	if !strings.Contains(msg, "file-tree:wt1") {
		t.Fatalf("expected file-tree topic for nested write, got: %q", msg)
	}
}

func TestSkippedDirsDoNotNotify(t *testing.T) {
	dir := t.TempDir()
	nm := filepath.Join(dir, "node_modules")
	if err := os.Mkdir(nm, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}

	bus := events.NewBus()
	ch := bus.Subscribe()
	w := New(bus)
	if err := w.Watch("wt1", dir); err != nil {
		t.Fatalf("Watch: %v", err)
	}
	defer w.Close()
	time.Sleep(50 * time.Millisecond)

	if err := os.WriteFile(filepath.Join(nm, "dep.js"), []byte("x"), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}

	select {
	case msg := <-ch:
		t.Fatalf("unexpected notification for node_modules write: %q", msg)
	case <-time.After(400 * time.Millisecond):
		// expected: no event
	}
}

func TestUnwatchStopsNotifications(t *testing.T) {
	dir := t.TempDir()
	bus := events.NewBus()
	ch := bus.Subscribe()
	w := New(bus)
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
	case msg := <-ch:
		t.Fatalf("unexpected notification after Unwatch: %q", msg)
	case <-time.After(400 * time.Millisecond):
		// expected: no event
	}
}

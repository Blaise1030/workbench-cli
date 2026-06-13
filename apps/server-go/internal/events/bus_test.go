package events

import (
	"testing"
	"time"
)

func recv(t *testing.T, s *Subscriber) (string, bool) {
	t.Helper()
	select {
	case got, ok := <-s.C:
		return got, ok
	case <-time.After(time.Second):
		t.Fatalf("subscriber did not receive event")
		return "", false
	}
}

func expectNothing(t *testing.T, s *Subscriber) {
	t.Helper()
	select {
	case got := <-s.C:
		t.Fatalf("subscriber unexpectedly received %q", got)
	case <-time.After(100 * time.Millisecond):
	}
}

func TestBusDeliversGlobalTopicsToAll(t *testing.T) {
	bus := NewBus()
	first := bus.Subscribe(nil)
	second := bus.Subscribe(map[string]bool{"a": true})
	defer bus.Unsubscribe(first)
	defer bus.Unsubscribe(second)

	bus.Publish("worktrees")

	if got, _ := recv(t, first); got != `{"topics":["worktrees"]}` {
		t.Fatalf("first got %q", got)
	}
	if got, _ := recv(t, second); got != `{"topics":["worktrees"]}` {
		t.Fatalf("second got %q", got)
	}
}

func TestBusScopedTopicOnlyReachesInterestedSubscriber(t *testing.T) {
	bus := NewBus()
	viewingA := bus.Subscribe(map[string]bool{"a": true})
	viewingB := bus.Subscribe(map[string]bool{"b": true})
	defer bus.Unsubscribe(viewingA)
	defer bus.Unsubscribe(viewingB)

	bus.Publish("git-status:a", "file-tree:a")

	if got, _ := recv(t, viewingA); got != `{"topics":["git-status:a","file-tree:a"]}` {
		t.Fatalf("viewingA got %q", got)
	}
	expectNothing(t, viewingB)
}

func TestBusFiltersMixedTopicsPerSubscriber(t *testing.T) {
	bus := NewBus()
	viewingB := bus.Subscribe(map[string]bool{"b": true})
	defer bus.Unsubscribe(viewingB)

	// A global topic bundled with a scoped topic for another worktree: the
	// subscriber should receive only the global one.
	bus.Publish("worktrees", "git-status:a")

	if got, _ := recv(t, viewingB); got != `{"topics":["worktrees"]}` {
		t.Fatalf("viewingB got %q", got)
	}
}

func TestBusGlobalOnlySubscriberDropsScopedTopics(t *testing.T) {
	bus := NewBus()
	global := bus.Subscribe(nil)
	defer bus.Unsubscribe(global)

	bus.Publish("git-status:a")
	expectNothing(t, global)
}

func TestBusUnsubscribeClosesAndRemovesSubscriber(t *testing.T) {
	bus := NewBus()
	s := bus.Subscribe(nil)

	bus.Unsubscribe(s)
	bus.Publish("worktrees")

	select {
	case _, ok := <-s.C:
		if ok {
			t.Fatal("unsubscribed channel remained open")
		}
	case <-time.After(time.Second):
		t.Fatal("unsubscribed channel was not closed")
	}
}

package events

import (
	"testing"
	"time"
)

func TestBusPublishesToSubscribers(t *testing.T) {
	bus := NewBus()
	first := bus.Subscribe()
	second := bus.Subscribe()
	defer bus.Unsubscribe(first)
	defer bus.Unsubscribe(second)

	bus.Publish(`{"topics":["worktrees"]}`)

	for name, ch := range map[string]chan string{"first": first, "second": second} {
		select {
		case got := <-ch:
			if got != `{"topics":["worktrees"]}` {
				t.Fatalf("%s subscriber got %q", name, got)
			}
		case <-time.After(time.Second):
			t.Fatalf("%s subscriber did not receive event", name)
		}
	}
}

func TestBusUnsubscribeClosesAndRemovesSubscriber(t *testing.T) {
	bus := NewBus()
	ch := bus.Subscribe()

	bus.Unsubscribe(ch)
	bus.Publish("after-close")

	select {
	case _, ok := <-ch:
		if ok {
			t.Fatal("unsubscribed channel remained open")
		}
	case <-time.After(time.Second):
		t.Fatal("unsubscribed channel was not closed")
	}
}

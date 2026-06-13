package events

import (
	"encoding/json"
	"strings"
	"sync"
)

// Subscriber is an active SSE listener. Messages relevant to its interest set are
// delivered on C. Interest is fixed for the life of the subscription; a client
// that changes which worktree it views reconnects with a new interest set.
type Subscriber struct {
	C        chan string
	interest map[string]bool // worktree ids; empty/nil = global topics only
}

// Bus broadcasts topic notifications to active subscribers, filtered per
// subscriber so a client only receives per-worktree topics for worktrees it
// declared interest in.
type Bus struct {
	mu          sync.RWMutex
	subscribers map[*Subscriber]struct{}
}

func NewBus() *Bus {
	return &Bus{subscribers: map[*Subscriber]struct{}{}}
}

// Subscribe registers a listener interested in the given worktree ids. A nil or
// empty interest set receives only global topics (those without a ":" scope, e.g.
// "sessions" / "worktrees").
func (b *Bus) Subscribe(interest map[string]bool) *Subscriber {
	s := &Subscriber{C: make(chan string, 16), interest: interest}
	b.mu.Lock()
	b.subscribers[s] = struct{}{}
	b.mu.Unlock()
	return s
}

func (b *Bus) Unsubscribe(s *Subscriber) {
	b.mu.Lock()
	if _, ok := b.subscribers[s]; ok {
		delete(b.subscribers, s)
		close(s.C)
	}
	b.mu.Unlock()
}

// Publish delivers topics to each subscriber, filtered to the topics relevant to
// that subscriber, as a single {"topics":[...]} JSON message. Subscribers whose
// relevant subset is empty receive nothing. Sends are non-blocking: a full
// subscriber channel drops the message (the 30s client poll / refetch-on-focus is
// the correctness fallback).
func (b *Bus) Publish(topics ...string) {
	if len(topics) == 0 {
		return
	}
	b.mu.RLock()
	defer b.mu.RUnlock()
	for s := range b.subscribers {
		subset := relevant(topics, s.interest)
		if len(subset) == 0 {
			continue
		}
		data, err := json.Marshal(map[string][]string{"topics": subset})
		if err != nil {
			continue
		}
		select {
		case s.C <- string(data):
		default:
		}
	}
}

// relevant returns the topics a subscriber with the given interest should receive:
// every global topic, plus scoped topics whose worktree id is in interest.
func relevant(topics []string, interest map[string]bool) []string {
	out := make([]string, 0, len(topics))
	for _, t := range topics {
		id, scoped := scopeID(t)
		if !scoped || interest[id] {
			out = append(out, t)
		}
	}
	return out
}

// scopeID splits a topic into its worktree id. Scoped topics carry an id after a
// ":" (e.g. "git-status:<id>", "file-tree:<id>"); topics without ":" are global.
func scopeID(topic string) (id string, scoped bool) {
	if i := strings.IndexByte(topic, ':'); i >= 0 {
		return topic[i+1:], true
	}
	return "", false
}

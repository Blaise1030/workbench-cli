package events

import "sync"

// Bus broadcasts string payloads to active subscribers.
type Bus struct {
	mu          sync.RWMutex
	subscribers map[chan string]struct{}
}

func NewBus() *Bus {
	return &Bus{subscribers: map[chan string]struct{}{}}
}

func (b *Bus) Subscribe() chan string {
	ch := make(chan string, 16)
	b.mu.Lock()
	b.subscribers[ch] = struct{}{}
	b.mu.Unlock()
	return ch
}

func (b *Bus) Unsubscribe(ch chan string) {
	b.mu.Lock()
	if _, ok := b.subscribers[ch]; ok {
		delete(b.subscribers, ch)
		close(ch)
	}
	b.mu.Unlock()
}

func (b *Bus) Publish(message string) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	for ch := range b.subscribers {
		select {
		case ch <- message:
		default:
		}
	}
}

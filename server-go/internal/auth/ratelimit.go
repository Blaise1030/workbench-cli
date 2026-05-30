package auth

import (
	"sync"
	"time"
)

type ipEntry struct {
	count     int
	windowEnd time.Time
}

type RateLimiter struct {
	mu      sync.Mutex
	entries map[string]*ipEntry
	max     int
	window  time.Duration
}

func NewRateLimiter(max int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		entries: make(map[string]*ipEntry),
		max:     max,
		window:  window,
	}
}

// Allow returns true if the IP has not exceeded the rate limit within the current
// fixed window. The window resets when the current time passes windowEnd.
func (rl *RateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	e, ok := rl.entries[ip]
	if !ok || now.After(e.windowEnd) {
		rl.entries[ip] = &ipEntry{count: 1, windowEnd: now.Add(rl.window)}
		return true
	}
	if e.count >= rl.max {
		return false
	}
	e.count++
	return true
}

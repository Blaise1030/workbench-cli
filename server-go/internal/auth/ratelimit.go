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

// Allow returns true if the IP is within its rate limit, false if it is over.
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

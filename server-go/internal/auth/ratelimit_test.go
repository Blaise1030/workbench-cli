package auth

import (
	"testing"
	"time"
)

func TestRateLimiter_AllowsUnderLimit(t *testing.T) {
	rl := NewRateLimiter(3, time.Minute)
	for i := 0; i < 3; i++ {
		if !rl.Allow("1.2.3.4") {
			t.Fatalf("attempt %d should be allowed", i+1)
		}
	}
}

func TestRateLimiter_BlocksAtLimit(t *testing.T) {
	rl := NewRateLimiter(3, time.Minute)
	for i := 0; i < 3; i++ {
		rl.Allow("1.2.3.4")
	}
	if rl.Allow("1.2.3.4") {
		t.Error("4th attempt should be blocked")
	}
}

func TestRateLimiter_ResetsAfterWindow(t *testing.T) {
	rl := NewRateLimiter(2, 50*time.Millisecond)
	rl.Allow("1.2.3.4")
	rl.Allow("1.2.3.4")
	time.Sleep(60 * time.Millisecond)
	if !rl.Allow("1.2.3.4") {
		t.Error("should be allowed after window resets")
	}
}

func TestRateLimiter_IsolatesIPs(t *testing.T) {
	rl := NewRateLimiter(1, time.Minute)
	rl.Allow("1.1.1.1")
	if !rl.Allow("2.2.2.2") {
		t.Error("different IP should not be rate-limited")
	}
}

package auth

import (
	"crypto/rand"
	"encoding/hex"
	"sync"
	"time"
)

const inviteTTL = 15 * time.Minute

type InviteToken struct {
	mu        sync.Mutex
	Value     string
	ExpiresAt time.Time
	Used      bool
}

func CreateInvite() *InviteToken {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return &InviteToken{
		Value:     hex.EncodeToString(b),
		ExpiresAt: time.Now().Add(inviteTTL),
	}
}

func (inv *InviteToken) Valid(input string) bool {
	if inv == nil {
		return false
	}
	inv.mu.Lock()
	defer inv.mu.Unlock()
	if inv.Used || !time.Now().Before(inv.ExpiresAt) {
		return false
	}
	return input == inv.Value
}

func (inv *InviteToken) Consume() {
	if inv == nil {
		return
	}
	inv.mu.Lock()
	inv.Used = true
	inv.mu.Unlock()
}

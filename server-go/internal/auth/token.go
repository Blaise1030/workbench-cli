package auth

import (
	"crypto/rand"
	"encoding/hex"
	"time"
)

const tokenTTL = time.Hour

type SessionToken struct {
	Value     string
	ExpiresAt time.Time
}

func CreateToken() SessionToken {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return SessionToken{
		Value:     hex.EncodeToString(b),
		ExpiresAt: time.Now().Add(tokenTTL),
	}
}

func (t SessionToken) Expired() bool {
	return !time.Now().Before(t.ExpiresAt)
}

func (t SessionToken) Valid(input string) bool {
	return !t.Expired() && input == t.Value
}

package auth

import (
	"crypto/rand"
	"crypto/subtle"
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
	if t.Expired() {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(input), []byte(t.Value)) == 1
}

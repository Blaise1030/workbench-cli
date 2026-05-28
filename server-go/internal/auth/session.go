package auth

import (
	"crypto/rand"
	"encoding/hex"
	"sync"
)

type Session struct {
	mu     sync.RWMutex
	sid    string
	active bool
}

func CreateSession() *Session {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return &Session{sid: hex.EncodeToString(b)}
}

func (s *Session) Activate() {
	s.mu.Lock()
	s.active = true
	s.mu.Unlock()
}

func (s *Session) Deactivate() {
	s.mu.Lock()
	s.active = false
	s.mu.Unlock()
}

func (s *Session) Validate(sid string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.active && s.sid == sid
}

func (s *Session) Active() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.active
}

func (s *Session) SID() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.sid
}

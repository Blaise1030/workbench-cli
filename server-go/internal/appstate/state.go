package appstate

import (
	"sync"

	"github.com/blaisetiong/workbench-cli/server-go/internal/auth"
)

// LanManager is a minimal interface for invite retrieval.
// Full implementation lives in internal/lan (Phase 6).
type LanManager interface {
	GetInvite() *auth.InviteToken
}

// stubLan satisfies LanManager with no active invite.
type stubLan struct{}

func (stubLan) GetInvite() *auth.InviteToken { return nil }

type AppState struct {
	mu      sync.RWMutex
	Token   auth.SessionToken
	Session *auth.Session
	Lan     LanManager
}

func New() *AppState {
	return &AppState{
		Token:   auth.CreateToken(),
		Session: auth.CreateSession(),
		Lan:     stubLan{},
	}
}

func (s *AppState) SetLan(lan LanManager) {
	s.mu.Lock()
	s.Lan = lan
	s.mu.Unlock()
}

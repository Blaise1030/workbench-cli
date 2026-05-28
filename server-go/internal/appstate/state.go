package appstate

import (
	"path/filepath"
	"sync"

	"github.com/blaisetiong/workbench-cli/server-go/internal/auth"
	"github.com/blaisetiong/workbench-cli/server-go/internal/config"
	"github.com/blaisetiong/workbench-cli/server-go/internal/settings"
)

// LanManager combines auth invite retrieval with settings LAN provider.
// Full implementation lives in internal/lan (Phase 6).
type LanManager interface {
	GetInvite() *auth.InviteToken
	settings.LanProvider
}

type AppState struct {
	mu           sync.RWMutex
	Token        auth.SessionToken
	Session      *auth.Session
	Lan          LanManager
	SettingsStore settings.Store
}

func New(port int, host string, forceHTTP bool) *AppState {
	storeFile := filepath.Join(config.DataDir(), "settings.json")
	return &AppState{
		Token:         auth.CreateToken(),
		Session:       auth.CreateSession(),
		Lan:           NewStubLan(port, host, forceHTTP),
		SettingsStore: settings.NewFileStore(storeFile),
	}
}

func (s *AppState) SetLan(lan LanManager) {
	s.mu.Lock()
	s.Lan = lan
	s.mu.Unlock()
}

package appstate

import (
	"database/sql"
	"path/filepath"
	"sync"

	"github.com/blaisetiong/workbench-cli/server-go/internal/auth"
	"github.com/blaisetiong/workbench-cli/server-go/internal/config"
	"github.com/blaisetiong/workbench-cli/server-go/internal/db"
	"github.com/blaisetiong/workbench-cli/server-go/internal/settings"
)

// LanManager combines auth invite retrieval with settings LAN provider.
type LanManager interface {
	GetInvite() *auth.InviteToken
	settings.LanProvider
}

type AppState struct {
	mu            sync.RWMutex
	Token         auth.SessionToken
	Session       *auth.Session
	Lan           LanManager
	SettingsStore settings.Store
	DB            *sql.DB
}

func New(port int, host string, forceHTTP bool) (*AppState, error) {
	storeFile := filepath.Join(config.DataDir(), "settings.json")
	database, err := db.Open(config.DbPath())
	if err != nil {
		return nil, err
	}
	return &AppState{
		Token:         auth.CreateToken(),
		Session:       auth.CreateSession(),
		Lan:           NewStubLan(port, host, forceHTTP),
		SettingsStore: settings.NewFileStore(storeFile),
		DB:            database,
	}, nil
}

func (s *AppState) SetLan(lan LanManager) {
	s.mu.Lock()
	s.Lan = lan
	s.mu.Unlock()
}

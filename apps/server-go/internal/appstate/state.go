package appstate

import (
	"database/sql"
	"path/filepath"
	"sync"

	"github.com/blaisetiong/workbench-cli/server-go/internal/auth"
	"github.com/blaisetiong/workbench-cli/server-go/internal/config"
	"github.com/blaisetiong/workbench-cli/server-go/internal/db"
	"github.com/blaisetiong/workbench-cli/server-go/internal/events"
	"github.com/blaisetiong/workbench-cli/server-go/internal/lan"
	"github.com/blaisetiong/workbench-cli/server-go/internal/settings"
	"github.com/blaisetiong/workbench-cli/server-go/internal/watcher"
)

type AppState struct {
	mu              sync.RWMutex
	Session         *auth.Session
	Lan             *lan.Manager
	SettingsStore   settings.Store
	DB              *sql.DB
	EventBus        *events.Bus
	WorktreeWatcher *watcher.WorktreeWatcher
}

func New(port int, host string, forceHTTP bool, lanMode bool) (*AppState, error) {
	storeFile := filepath.Join(config.DataDir(), "settings.json")
	database, err := db.Open(config.DbPath())
	if err != nil {
		return nil, err
	}
	bus := events.NewBus()
	return &AppState{
		Session:         auth.CreateSession(),
		Lan:             lan.New(port, host, forceHTTP, lanMode),
		SettingsStore:   settings.NewFileStore(storeFile),
		DB:              database,
		EventBus:        bus,
		WorktreeWatcher: watcher.New(bus),
	}, nil
}

func (s *AppState) SetLan(l *lan.Manager) {
	s.mu.Lock()
	s.Lan = l
	s.mu.Unlock()
}

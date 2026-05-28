package appstate

import (
	"fmt"

	"github.com/blaisetiong/workbench-cli/server-go/internal/auth"
	"github.com/blaisetiong/workbench-cli/server-go/internal/settings"
)

// StubLan satisfies both appstate.LanManager and settings.LanProvider.
// Full implementation lives in internal/lan (Phase 6).
type StubLan struct {
	port      int
	localHost string
	scheme    string
}

func NewStubLan(port int, localHost string, forceHTTP bool) *StubLan {
	scheme := "https"
	if forceHTTP {
		scheme = "http"
	}
	return &StubLan{port: port, localHost: localHost, scheme: scheme}
}

func (l *StubLan) GetInvite() *auth.InviteToken { return nil }

// settings.LanProvider

func (l *StubLan) GetPublicState() settings.LanPublicState {
	return settings.LanPublicState{Enabled: false}
}
func (l *StubLan) Mode() string  { return "localhost" }
func (l *StubLan) Enable(_ string) {}
func (l *StubLan) Disable()         {}
func (l *StubLan) RefreshInvite()   {}
func (l *StubLan) GetLocalURL() string {
	return fmt.Sprintf("%s://%s:%d/", l.scheme, l.localHost, l.port)
}
func (l *StubLan) GetURLScheme() string { return l.scheme }
func (l *StubLan) GetLocalHost() string { return l.localHost }
func (l *StubLan) Port() int            { return l.port }

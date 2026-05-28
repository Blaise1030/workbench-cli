package settings

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/blaisetiong/workbench-cli/server-go/internal/auth"
	"github.com/blaisetiong/workbench-cli/server-go/internal/config"
)

// LanProvider is the interface the settings router needs from LanManager.
type LanProvider interface {
	GetPublicState() LanPublicState
	Mode() string // "localhost" or "lan"
	Enable(lanIP string)
	Disable()
	RefreshInvite()
	GetLocalURL() string
	GetURLScheme() string
	GetLocalHost() string
	Port() int
}

// LanPublicState matches lanPublicStateSchema.
type LanPublicState struct {
	Enabled         bool    `json:"enabled"`
	LanURL          *string `json:"lanUrl,omitempty"`
	InviteExpiresAt *int64  `json:"inviteExpiresAt,omitempty"`
}

// NetworkSettings matches networkSettingsSchema.
type NetworkSettings struct {
	Host           string `json:"host"`
	Port           int    `json:"port"`
	LocalURL       string `json:"localUrl"`
	Scheme         string `json:"scheme"`
	HostsFileLine  string `json:"hostsFileLine"`
	PendingRestart bool   `json:"pendingRestart"`
}

func getLanIP() string {
	ifaces, _ := net.Interfaces()
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, _ := iface.Addrs()
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			if ip4 := ip.To4(); ip4 != nil {
				return ip4.String()
			}
		}
	}
	return "127.0.0.1"
}

func buildNetworkSettings(lan LanProvider) NetworkSettings {
	saved := config.LoadNetworkConfig()
	running := config.NetworkConfig{Host: lan.GetLocalHost(), Port: lan.Port()}
	pendingRestart := saved.Host != running.Host || saved.Port != running.Port
	return NetworkSettings{
		Host:          saved.Host,
		Port:          saved.Port,
		LocalURL:      lan.GetLocalURL(),
		Scheme:        lan.GetURLScheme(),
		HostsFileLine: fmt.Sprintf("127.0.0.1 %s", saved.Host),
		PendingRestart: pendingRestart,
	}
}

func jsonResp(w http.ResponseWriter, v any, code int) {
	w.Header().Set("Content-Type", "application/json")
	if code != http.StatusOK {
		w.WriteHeader(code)
	}
	_ = json.NewEncoder(w).Encode(v)
}

func RegisterRoutes(r chi.Router, session *auth.Session, store Store, lan LanProvider, onLanToggle func(bool) error) {
	r.Use(auth.RequireSession(session))

	// LAN
	r.Get("/lan", func(w http.ResponseWriter, r *http.Request) {
		jsonResp(w, lan.GetPublicState(), http.StatusOK)
	})
	r.Post("/lan", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Enabled bool `json:"enabled"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			jsonResp(w, map[string]string{"error": "Bad request"}, http.StatusBadRequest)
			return
		}
		if body.Enabled {
			if getLanIP() == "127.0.0.1" {
				jsonResp(w, map[string]string{"error": "No network interface found"}, http.StatusServiceUnavailable)
				return
			}
		}
		if err := onLanToggle(body.Enabled); err != nil {
			jsonResp(w, map[string]string{"error": err.Error()}, http.StatusInternalServerError)
			return
		}
		jsonResp(w, lan.GetPublicState(), http.StatusOK)
	})
	r.Post("/lan/refresh-invite", func(w http.ResponseWriter, r *http.Request) {
		if lan.Mode() != "lan" {
			jsonResp(w, map[string]string{"error": "LAN is not enabled"}, http.StatusBadRequest)
			return
		}
		lan.RefreshInvite()
		jsonResp(w, lan.GetPublicState(), http.StatusOK)
	})

	// Network
	r.Get("/network", func(w http.ResponseWriter, r *http.Request) {
		jsonResp(w, buildNetworkSettings(lan), http.StatusOK)
	})
	r.Patch("/network", func(w http.ResponseWriter, r *http.Request) {
		var patch struct {
			Host *string `json:"host,omitempty"`
			Port *int    `json:"port,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
			jsonResp(w, map[string]string{"error": "Bad request"}, http.StatusBadRequest)
			return
		}
		if patch.Host == nil && patch.Port == nil {
			jsonResp(w, map[string]string{"error": "No changes provided"}, http.StatusBadRequest)
			return
		}
		saved := config.LoadNetworkConfig()
		if patch.Host != nil {
			h := strings.TrimSpace(*patch.Host)
			if h == "" || len(h) > 253 {
				jsonResp(w, map[string]string{"error": "Invalid host"}, http.StatusBadRequest)
				return
			}
			saved.Host = h
		}
		if patch.Port != nil {
			if *patch.Port < 1 || *patch.Port > 65535 {
				jsonResp(w, map[string]string{"error": "Invalid port"}, http.StatusBadRequest)
				return
			}
			saved.Port = *patch.Port
		}
		if err := config.SaveNetworkConfig(saved); err != nil {
			jsonResp(w, map[string]string{"error": err.Error()}, http.StatusInternalServerError)
			return
		}
		jsonResp(w, buildNetworkSettings(lan), http.StatusOK)
	})

	// Terminal settings
	r.Get("/terminal", func(w http.ResponseWriter, r *http.Request) {
		jsonResp(w, GetTerminalSettings(store), http.StatusOK)
	})
	r.Patch("/terminal", func(w http.ResponseWriter, r *http.Request) {
		var patch PatchTerminalSettings
		if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
			jsonResp(w, map[string]string{"error": "Bad request"}, http.StatusBadRequest)
			return
		}
		jsonResp(w, PatchTerminalSettingsFn(store, patch), http.StatusOK)
	})

	// Resume commands
	r.Get("/terminal/resume-commands", func(w http.ResponseWriter, r *http.Request) {
		jsonResp(w, map[string]any{"approvedPrefixes": ListApprovedResumePrefixes(store)}, http.StatusOK)
	})
	r.Post("/terminal/resume-commands", func(w http.ResponseWriter, r *http.Request) {
		var input CreateApprovedResumePrefix
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil || strings.TrimSpace(input.Prefix) == "" {
			jsonResp(w, map[string]string{"error": "prefix is required"}, http.StatusBadRequest)
			return
		}
		input.Prefix = strings.TrimSpace(input.Prefix)
		entry := AddApprovedResumePrefix(store, input)
		jsonResp(w, map[string]any{"prefix": entry}, http.StatusCreated)
	})
	r.Delete("/terminal/resume-commands/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		if !RevokeApprovedResumePrefix(store, id) {
			jsonResp(w, map[string]string{"error": "Not found"}, http.StatusNotFound)
			return
		}
		jsonResp(w, map[string]bool{"ok": true}, http.StatusOK)
	})
}

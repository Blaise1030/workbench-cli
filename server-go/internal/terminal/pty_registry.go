package terminal

import (
	"fmt"
	"log/slog"
	"os"
	"regexp"
	"strconv"
	"sync"
	"time"

	"github.com/creack/pty"
)

var resizeRE = regexp.MustCompile(`^\x1b\[RESIZE:(\d+);(\d+)\]$`)

func parseResize(msg string) (cols, rows uint16, ok bool) {
	m := resizeRE.FindStringSubmatch(msg)
	if m == nil {
		return 0, 0, false
	}
	c, _ := strconv.ParseUint(m[1], 10, 16)
	r, _ := strconv.ParseUint(m[2], 10, 16)
	return uint16(c), uint16(r), true
}

// clientConn represents a connected WebSocket client via channels.
type clientConn struct {
	send chan []byte
	done chan struct{}
}

type ptyEntry struct {
	cwd            string
	resumeCommand  *string
	resumeTrusted  bool
	agentKind      *string
	agentSessionID *string

	ptySide    *os.File
	ring       *RingBuffer
	oscCarry   string

	mu           sync.Mutex
	clients      map[*clientConn]struct{}
	idleTimer    *time.Timer
	lastActivity int64
	exitCode     *int
}

// Registry is the PTY registry.
type Registry struct {
	mu      sync.RWMutex
	entries map[string]*ptyEntry

	capBytes    int
	idleTTL     time.Duration
	onCmdComplete func(terminalID string, report OscCommandReport)
}

type RegistryConfig struct {
	CapBytes      int
	IdleTTL       time.Duration
	OnCmdComplete func(terminalID string, report OscCommandReport)
}

func NewRegistry(cfg RegistryConfig) *Registry {
	capBytes := cfg.CapBytes
	if capBytes <= 0 {
		capBytes = 4096 * 1024
	}
	idleTTL := cfg.IdleTTL
	if idleTTL <= 0 {
		idleTTL = 24 * time.Hour
	}
	return &Registry{
		entries:       make(map[string]*ptyEntry),
		capBytes:      capBytes,
		idleTTL:       idleTTL,
		onCmdComplete: cfg.OnCmdComplete,
	}
}

func processEnv() map[string]string {
	env := make(map[string]string)
	for _, kv := range os.Environ() {
		for i, c := range kv {
			if c == '=' {
				env[kv[:i]] = kv[i+1:]
				break
			}
		}
	}
	return env
}

func (reg *Registry) getOrCreate(terminalID string, cwd string, resumeCommand *string, resumeTrusted bool, agentKind, agentSessionID *string) *ptyEntry {
	reg.mu.Lock()
	defer reg.mu.Unlock()
	if e, ok := reg.entries[terminalID]; ok {
		return e
	}
	e := &ptyEntry{
		cwd:            cwd,
		resumeCommand:  resumeCommand,
		resumeTrusted:  resumeTrusted,
		agentKind:      agentKind,
		agentSessionID: agentSessionID,
		ring:           NewRingBuffer(reg.capBytes),
		clients:        make(map[*clientConn]struct{}),
		lastActivity:   time.Now().UnixMilli(),
	}
	reg.entries[terminalID] = e
	return e
}

// Attach connects a client to a terminal.
// skipReplay: don't send ring contents (reconnect case).
func (reg *Registry) Attach(terminalID string, conn *clientConn, cwd string, resumeCommand *string, resumeTrusted bool, agentKind, agentSessionID *string, skipReplay bool) {
	e := reg.getOrCreate(terminalID, cwd, resumeCommand, resumeTrusted, agentKind, agentSessionID)

	// Load from disk if not yet loaded
	if e.ring.ByteLen() == 0 {
		if _, data := LoadScrollback(terminalID); data != nil {
			e.ring.Append(data)
		}
	}

	// Clear idle timer
	e.mu.Lock()
	if e.idleTimer != nil {
		e.idleTimer.Stop()
		e.idleTimer = nil
	}
	e.clients[conn] = struct{}{}
	e.mu.Unlock()

	if !skipReplay {
		snap := e.ring.Snapshot()
		if len(snap) > 0 {
			select {
			case conn.send <- snap:
			default:
			}
		}
	}
}

// Detach disconnects a client and schedules idle kill if no clients remain.
func (reg *Registry) Detach(terminalID string, conn *clientConn) {
	reg.mu.RLock()
	e, ok := reg.entries[terminalID]
	reg.mu.RUnlock()
	if !ok {
		return
	}
	e.mu.Lock()
	delete(e.clients, conn)
	noClients := len(e.clients) == 0
	e.mu.Unlock()

	if noClients {
		reg.scheduleIdleKill(terminalID, e)
	}
}

func (reg *Registry) scheduleIdleKill(terminalID string, e *ptyEntry) {
	e.mu.Lock()
	if e.idleTimer != nil {
		e.idleTimer.Stop()
	}
	e.idleTimer = time.AfterFunc(reg.idleTTL, func() {
		reg.Kill(terminalID)
	})
	e.mu.Unlock()
}

// HandleMessage processes a WebSocket message from a client.
func (reg *Registry) HandleMessage(terminalID string, conn *clientConn, raw string) {
	reg.mu.RLock()
	e, ok := reg.entries[terminalID]
	reg.mu.RUnlock()
	if !ok {
		return
	}
	e.mu.Lock()
	_, hasConn := e.clients[conn]
	e.mu.Unlock()
	if !hasConn {
		return
	}

	cols, rows, isResize := parseResize(raw)
	if isResize {
		if e.ptySide == nil {
			go func() {
				if err := reg.spawnPTY(terminalID, e, cols, rows); err != nil {
					slog.Error("PTY spawn failed", "terminalId", terminalID, "err", err)
					// Close all clients
					e.mu.Lock()
					for c := range e.clients {
						close(c.done)
					}
					e.mu.Unlock()
				}
			}()
		} else {
			_ = pty.Setsize(e.ptySide, &pty.Winsize{Cols: cols, Rows: rows})
		}
		return
	}

	if e.ptySide != nil {
		_, _ = e.ptySide.Write([]byte(raw))
	}
}

func (reg *Registry) spawnPTY(terminalID string, e *ptyEntry, cols, rows uint16) error {
	shellPath := os.Getenv("SHELL")
	if shellPath == "" {
		shellPath = "/bin/zsh"
	}

	baseEnv := processEnv()
	sanitized := SanitizeEnv(baseEnv)
	spawnCfg := ShellIntegrationSpawn(shellPath, sanitized)

	envSlice := make([]string, 0, len(spawnCfg.Env))
	for k, v := range spawnCfg.Env {
		envSlice = append(envSlice, k+"="+v)
	}

	cwd := e.cwd
	if _, err := os.Stat(cwd); err != nil {
		home, _ := os.UserHomeDir()
		cwd = home
	}

	// Apply resume command if trusted
	args := spawnCfg.Args
	if e.resumeCommand != nil && e.resumeTrusted && *e.resumeCommand != "" {
		args = append(args, "-c", fmt.Sprintf("%s; exec %s -l", *e.resumeCommand, shellPath))
	}

	cmd := buildCmd(shellPath, args, envSlice, cwd)
	ptm, err := pty.StartWithSize(cmd, &pty.Winsize{Cols: cols, Rows: rows})
	if err != nil {
		return fmt.Errorf("pty.Start: %w", err)
	}
	e.ptySide = ptm

	// Goroutine: read PTY output → ring + fan-out to clients
	// CRITICAL: never hold registry lock during PTY read
	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := ptm.Read(buf)
			if n > 0 {
				chunk := make([]byte, n)
				copy(chunk, buf[:n])
				e.ring.Append(chunk)

				carry, reports := ParseOscStream(e.oscCarry, string(chunk))
				e.oscCarry = carry
				for _, r := range reports {
					if reg.onCmdComplete != nil {
						reg.onCmdComplete(terminalID, r)
					}
				}

				// Fan-out to all clients
				e.mu.Lock()
				for c := range e.clients {
					select {
					case c.send <- chunk:
					default:
					}
				}
				e.mu.Unlock()
			}
			if err != nil {
				break
			}
		}

		// PTY exited
		e.mu.Lock()
		for c := range e.clients {
			close(c.done)
		}
		e.mu.Unlock()

		// Persist scrollback
		snap := e.ring.Snapshot()
		if len(snap) > 0 {
			DumpScrollback(terminalID, snap, ScrollbackMeta{
				Cwd:          e.cwd,
				LastActivity: time.Now().UnixMilli(),
			})
		}

		// Schedule idle kill
		if len(e.clients) == 0 {
			reg.scheduleIdleKill(terminalID, e)
		}
	}()

	return nil
}

// Kill terminates a terminal's PTY and removes it from the registry.
func (reg *Registry) Kill(terminalID string) {
	reg.mu.Lock()
	e, ok := reg.entries[terminalID]
	if ok {
		delete(reg.entries, terminalID)
	}
	reg.mu.Unlock()
	if !ok {
		return
	}
	e.mu.Lock()
	if e.idleTimer != nil {
		e.idleTimer.Stop()
	}
	if e.ptySide != nil {
		_ = e.ptySide.Close()
	}
	for c := range e.clients {
		close(c.done)
	}
	e.mu.Unlock()
	DeleteScrollback(terminalID)
}

func (reg *Registry) Has(terminalID string) bool {
	reg.mu.RLock()
	_, ok := reg.entries[terminalID]
	reg.mu.RUnlock()
	return ok
}

func (reg *Registry) Shutdown() {
	reg.mu.Lock()
	ids := make([]string, 0, len(reg.entries))
	for id := range reg.entries {
		ids = append(ids, id)
	}
	reg.mu.Unlock()
	for _, id := range ids {
		reg.Kill(id)
	}
}

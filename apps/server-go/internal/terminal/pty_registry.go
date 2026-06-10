package terminal

import (
	"fmt"
	"log/slog"
	"os"
	"regexp"
	"strconv"
	"strings"
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
	worktreeID     string
	title          string
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
	agentStatus            string
	agentResumeAttempted   bool
	exited                 bool
}


// Registry is the PTY registry.
type Registry struct {
	mu      sync.RWMutex
	entries map[string]*ptyEntry

	pendingLaunch sync.Map // terminalID -> command (one-shot launch on first spawn)

	capBytes                  int
	idleTTL                   time.Duration
	serverPort                int
	autoResumeAgentSessions   func() bool
	agentHooksEnabled         func(kind string) bool
	buildAgentResumeArgv      func(kind, sessionID string) []string
	onCmdComplete             func(terminalID string, report OscCommandReport)
}

type RegistryConfig struct {
	CapBytes                  int
	IdleTTL                   time.Duration
	ServerPort                int
	AutoResumeAgentSessions   func() bool
	AgentHooksEnabled         func(kind string) bool
	BuildAgentResumeArgv      func(kind, sessionID string) []string
	OnCmdComplete             func(terminalID string, report OscCommandReport)
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
		entries:              make(map[string]*ptyEntry),
		capBytes:             capBytes,
		idleTTL:              idleTTL,
		serverPort:           cfg.ServerPort,
		autoResumeAgentSessions: cfg.AutoResumeAgentSessions,
		agentHooksEnabled:       cfg.AgentHooksEnabled,
		buildAgentResumeArgv:    cfg.BuildAgentResumeArgv,
		onCmdComplete:        cfg.OnCmdComplete,
	}
}

// SetPendingLaunch queues a one-shot shell command for the terminal's first PTY spawn.
func (reg *Registry) SetPendingLaunch(terminalID, command string) {
	command = strings.TrimSpace(command)
	if command == "" {
		return
	}
	reg.pendingLaunch.Store(terminalID, command)
}

func (reg *Registry) takePendingLaunch(terminalID string) (string, bool) {
	v, ok := reg.pendingLaunch.LoadAndDelete(terminalID)
	if !ok {
		return "", false
	}
	cmd, ok := v.(string)
	return cmd, ok && strings.TrimSpace(cmd) != ""
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

func (reg *Registry) getOrCreate(terminalID, worktreeID, title, cwd string, resumeCommand *string, resumeTrusted bool, agentKind, agentSessionID *string) *ptyEntry {
	reg.mu.Lock()
	defer reg.mu.Unlock()
	if e, ok := reg.entries[terminalID]; ok {
		if worktreeID != "" {
			e.worktreeID = worktreeID
		}
		if title != "" {
			e.title = title
		}
		return e
	}
	e := &ptyEntry{
		worktreeID:     worktreeID,
		title:          title,
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
func (reg *Registry) Attach(terminalID, worktreeID, title string, conn *clientConn, cwd string, resumeCommand *string, resumeTrusted bool, agentKind, agentSessionID *string, skipReplay bool) {
	e := reg.getOrCreate(terminalID, worktreeID, title, cwd, resumeCommand, resumeTrusted, agentKind, agentSessionID)

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

	reg.maybeInjectAgentResume(terminalID, e)
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
	ApplyWorkbenchEnv(spawnCfg.Env, terminalID, e.worktreeID, e.title, reg.serverPort)

	envSlice := make([]string, 0, len(spawnCfg.Env))
	for k, v := range spawnCfg.Env {
		envSlice = append(envSlice, k+"="+v)
	}

	cwd := e.cwd
	if _, err := os.Stat(cwd); err != nil {
		home, _ := os.UserHomeDir()
		cwd = home
	}

	// One-shot launch (e.g. agent start from + menu), then trusted resume, then agent auto-resume.
	args := spawnCfg.Args
	if cmd, ok := reg.takePendingLaunch(terminalID); ok {
		args = append(args, "-c", fmt.Sprintf("%s; exec %s -l", cmd, shellPath))
	} else if e.resumeCommand != nil && e.resumeTrusted && *e.resumeCommand != "" {
		args = append(args, "-c", fmt.Sprintf("%s; exec %s -l", *e.resumeCommand, shellPath))
	} else if resumeCmd, ok := reg.shouldAutoResumeAgent(e); ok {
		args = append(args, "-c", fmt.Sprintf("%s; exec %s -l", resumeCmd, shellPath))
		e.markAgentResumeAttempted()
	}

	cmd := buildCmd(shellPath, args, envSlice, cwd)
	ptm, err := pty.StartWithSize(cmd, &pty.Winsize{Cols: cols, Rows: rows})
	if err != nil {
		return fmt.Errorf("pty.Start: %w", err)
	}
	e.ptySide = ptm

	// dataCh carries raw PTY chunks to the coalescing goroutine.
	// Blocking send provides natural backpressure so the reader never outruns the flusher.
	dataCh := make(chan []byte, 128)

	// Coalescing goroutine: accumulates chunks over a 2ms window then fan-out once.
	// This mirrors node-pty's libuv behaviour where rapid writes are delivered as one callback.
	go func() {
		const window = 2 * time.Millisecond
		ticker := time.NewTicker(window)
		defer ticker.Stop()
		var pending []byte

		flush := func() {
			if len(pending) == 0 {
				return
			}
			data := pending
			pending = nil
			e.mu.Lock()
			for c := range e.clients {
				cp := make([]byte, len(data))
				copy(cp, data)
				select {
				case c.send <- cp:
				default:
				}
			}
			e.mu.Unlock()
		}

		for {
			select {
			case chunk, ok := <-dataCh:
				if !ok {
					flush()
					return
				}
				pending = append(pending, chunk...)
			case <-ticker.C:
				flush()
			}
		}
	}()

	// PTY read goroutine: reads output, updates ring + OSC state, feeds coalescer.
	// CRITICAL: never hold registry lock during PTY read.
	go func() {
		buf := make([]byte, 32*1024)
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

				dataCh <- chunk
			}
			if err != nil {
				break
			}
		}
		close(dataCh)

		// PTY exited
		e.mu.Lock()
		e.exited = true
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

// GetAgentStatus returns the current status and liveness of a terminal entry.
func (reg *Registry) GetAgentStatus(terminalID string) (status string, isAlive bool) {
	reg.mu.RLock()
	e, ok := reg.entries[terminalID]
	reg.mu.RUnlock()
	if !ok {
		return "done", false
	}
	e.mu.Lock()
	status = e.agentStatus
	isAlive = e.ptySide != nil && !e.exited
	e.mu.Unlock()
	if status == "" {
		if isAlive {
			status = "running"
		} else {
			status = "done"
		}
	}
	return status, isAlive
}

// SetAgentStatus updates the agent status for a terminal entry.
func (reg *Registry) SetAgentStatus(terminalID, status string) bool {
	reg.mu.RLock()
	e, ok := reg.entries[terminalID]
	reg.mu.RUnlock()
	if !ok {
		return false
	}
	e.mu.Lock()
	e.agentStatus = status
	if strings.EqualFold(strings.TrimSpace(status), "done") {
		e.agentResumeAttempted = false
	}
	e.mu.Unlock()
	return true
}

// SetAgentStatusIf flips a terminal's agent status to `set` only when the
// current status equals `want` (case-insensitive, trimmed). Returns true if
// the status changed. Used to clear needs_attention → idle without clobbering
// a concurrent state change.
func (reg *Registry) SetAgentStatusIf(terminalID, want, set string) bool {
	reg.mu.RLock()
	e, ok := reg.entries[terminalID]
	reg.mu.RUnlock()
	if !ok {
		return false
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	if !strings.EqualFold(strings.TrimSpace(e.agentStatus), strings.TrimSpace(want)) {
		return false
	}
	e.agentStatus = set
	return true
}

func (reg *Registry) maybeInjectAgentResume(terminalID string, e *ptyEntry) {
	resumeCmd, ok := reg.shouldAutoResumeAgent(e)
	if !ok {
		return
	}
	e.mu.Lock()
	ptySide := e.ptySide
	exited := e.exited
	e.mu.Unlock()
	if ptySide == nil || exited {
		return
	}
	line := resumeCmd + "\n"
	if _, err := ptySide.Write([]byte(line)); err != nil {
		slog.Warn("agent resume inject failed", "terminalId", terminalID, "err", err)
		return
	}
	e.markAgentResumeAttempted()
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

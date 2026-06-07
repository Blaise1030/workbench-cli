package terminal

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"github.com/blaisetiong/workbench-cli/server-go/internal/config"
)

// confined returns p and true only if p is directly inside base (no traversal).
func confined(base, p string) (string, bool) {
	cleanBase := filepath.Clean(base)
	cleanP := filepath.Clean(p)
	return cleanP, strings.HasPrefix(cleanP, cleanBase+string(os.PathSeparator))
}

type ScrollbackMeta struct {
	TerminalID   string `json:"terminalId"`
	Cwd          string `json:"cwd"`
	LastActivity int64  `json:"lastActivity"`
	ExitCode     *int   `json:"exitCode"`
}

// isValidTerminalID rejects IDs that could be used for path traversal.
func isValidTerminalID(id string) bool {
	return id != "" && !strings.ContainsAny(id, `/\`) && filepath.Clean(id) == id
}

func scrollbackDir() string     { return config.ScrollbackDir() }
func scrollbackPrevDir() string { return filepath.Join(config.DataDir(), "scrollback", "previous") }

func scrollbackPaths(terminalID string, previous bool) (bin, meta string, ok bool) {
	base := scrollbackDir()
	if previous {
		base = scrollbackPrevDir()
	}
	var binOk, metaOk bool
	bin, binOk = confined(base, filepath.Join(base, terminalID+".bin"))
	meta, metaOk = confined(base, filepath.Join(base, terminalID+".meta.json"))
	ok = binOk && metaOk
	return
}

func ensureScrollbackDirs() {
	_ = os.MkdirAll(scrollbackDir(), 0o755)
	_ = os.MkdirAll(scrollbackPrevDir(), 0o755)
}

func DumpScrollback(terminalID string, data []byte, meta ScrollbackMeta) {
	if len(data) == 0 || !isValidTerminalID(terminalID) {
		return
	}
	ensureScrollbackDirs()
	meta.TerminalID = terminalID
	metaJSON, _ := json.Marshal(meta)
	binA, metaA, ok1 := scrollbackPaths(terminalID, false)
	binP, metaP, ok2 := scrollbackPaths(terminalID, true)
	if !ok1 || !ok2 {
		return
	}
	_ = os.WriteFile(binA, data, 0o644)
	_ = os.WriteFile(metaA, metaJSON, 0o644)
	_ = copyFile(binA, binP)
	_ = copyFile(metaA, metaP)
}

func LoadScrollback(terminalID string) (*ScrollbackMeta, []byte) {
	if !isValidTerminalID(terminalID) {
		return nil, nil
	}
	binPath, metaPath, ok := scrollbackPaths(terminalID, false)
	if !ok {
		return nil, nil
	}
	data, err := os.ReadFile(binPath)
	if err != nil {
		return nil, nil
	}
	raw, err := os.ReadFile(metaPath)
	if err != nil {
		return nil, nil
	}
	var meta ScrollbackMeta
	if err := json.Unmarshal(raw, &meta); err != nil || meta.TerminalID != terminalID {
		return nil, nil
	}
	return &meta, data
}

func DeleteScrollback(terminalID string) {
	if !isValidTerminalID(terminalID) {
		return
	}
	for _, prev := range []bool{false, true} {
		bin, meta, ok := scrollbackPaths(terminalID, prev)
		if !ok {
			continue
		}
		_ = os.Remove(bin)
		_ = os.Remove(meta)
	}
}

func copyFile(src, dst string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, data, 0o644)
}

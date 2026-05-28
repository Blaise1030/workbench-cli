package terminal

import (
	"encoding/json"
	"os"
	"path/filepath"

	"github.com/blaisetiong/workbench-cli/server-go/internal/config"
)

type ScrollbackMeta struct {
	TerminalID   string `json:"terminalId"`
	Cwd          string `json:"cwd"`
	LastActivity int64  `json:"lastActivity"`
	ExitCode     *int   `json:"exitCode"`
}

func scrollbackDir() string     { return config.ScrollbackDir() }
func scrollbackPrevDir() string { return filepath.Join(config.DataDir(), "scrollback", "previous") }

func scrollbackPaths(terminalID string, previous bool) (bin, meta string) {
	base := scrollbackDir()
	if previous {
		base = scrollbackPrevDir()
	}
	return filepath.Join(base, terminalID+".bin"),
		filepath.Join(base, terminalID+".meta.json")
}

func ensureScrollbackDirs() {
	_ = os.MkdirAll(scrollbackDir(), 0o755)
	_ = os.MkdirAll(scrollbackPrevDir(), 0o755)
}

func DumpScrollback(terminalID string, data []byte, meta ScrollbackMeta) {
	if len(data) == 0 {
		return
	}
	ensureScrollbackDirs()
	meta.TerminalID = terminalID
	metaJSON, _ := json.Marshal(meta)
	binA, metaA := scrollbackPaths(terminalID, false)
	binP, metaP := scrollbackPaths(terminalID, true)
	_ = os.WriteFile(binA, data, 0o644)
	_ = os.WriteFile(metaA, metaJSON, 0o644)
	_ = copyFile(binA, binP)
	_ = copyFile(metaA, metaP)
}

func LoadScrollback(terminalID string) (*ScrollbackMeta, []byte) {
	binPath, metaPath := scrollbackPaths(terminalID, false)
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
	for _, prev := range []bool{false, true} {
		bin, meta := scrollbackPaths(terminalID, prev)
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

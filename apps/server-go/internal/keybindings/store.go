package keybindings

import (
	"encoding/json"
	"os"
	"path/filepath"

	"github.com/blaisetiong/workbench-cli/server-go/internal/config"
)

var defaultKeybindings = Map{
	"terminal.newTerminal": "Ctrl+Shift+n",
	"panel.explorer":       "Ctrl+Shift+e",
	"panel.git":            "Ctrl+Shift+g",
	"contextQueue.invoke":  "Ctrl+l",
	"settings.open":        "Ctrl+Shift+,",
	"terminal.tab.1":       "Option+¡",
	"terminal.tab.2":       "Option+™",
	"terminal.tab.3":       "Option+£",
	"terminal.tab.4":       "Option+¢",
	"terminal.tab.5":       "Option+∞",
	"terminal.tab.6":       "Option+§",
	"terminal.tab.7":       "Option+¶",
	"terminal.tab.8":       "Option+•",
	"terminal.tab.9":       "Option+ª",
}

// Map is a keybinding action → key-combo map.
type Map map[string]string

func FilePath() string {
	return filepath.Join(config.DataDir(), "keybindings.json")
}

func Get() (Map, error) {
	result := make(Map, len(defaultKeybindings))
	for k, v := range defaultKeybindings {
		result[k] = v
	}
	raw, err := os.ReadFile(FilePath())
	if err != nil {
		return result, nil
	}
	var saved Map
	if err := json.Unmarshal(raw, &saved); err != nil {
		return result, nil
	}
	for k, v := range saved {
		result[k] = v
	}
	return result, nil
}

func Put(m Map) error {
	if err := os.MkdirAll(filepath.Dir(FilePath()), 0o755); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(FilePath(), raw, 0o644)
}

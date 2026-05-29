package workspace

import (
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// PickFolder opens a native folder picker on the server machine.
// Returns ("", true) when the user cancels or the picker is unavailable.
func PickFolder() (path string, cancelled bool) {
	var raw []byte
	var err error

	switch runtime.GOOS {
	case "darwin":
		raw, err = exec.Command(
			"osascript",
			"-e",
			`POSIX path of (choose folder with prompt "Select git repository")`,
		).Output()
	case "linux":
		raw, err = exec.Command(
			"zenity",
			"--file-selection",
			"--directory",
			"--title=Select git repository",
		).Output()
	case "windows":
		script := strings.Join([]string{
			"Add-Type -AssemblyName System.Windows.Forms",
			"$d = New-Object System.Windows.Forms.FolderBrowserDialog",
			`$d.Description = "Select git repository"`,
			"if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {",
			"  Write-Output $d.SelectedPath",
			"}",
		}, "; ")
		raw, err = exec.Command("powershell", "-NoProfile", "-Command", script).Output()
	default:
		return "", true
	}

	if err != nil {
		return "", true
	}
	normalized := normalizePickedPath(string(raw))
	if normalized == "" {
		return "", true
	}
	return normalized, false
}

func normalizePickedPath(raw string) string {
	path := strings.TrimSpace(raw)
	path = strings.TrimRight(path, "/")
	if path == "" {
		return ""
	}
	// osascript may append a newline; filepath.Clean is safe for absolute paths.
	if abs, err := filepath.Abs(path); err == nil {
		return abs
	}
	return path
}

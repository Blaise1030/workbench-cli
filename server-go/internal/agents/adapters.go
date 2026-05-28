package agents

import (
	"os"
	"path/filepath"
	"strings"
)

type Adapter struct {
	Kind       string
	Binaries   []string
	ResumeArgs func(sessionID string) []string
	FindLatest func(cwd, home string) string
}

func newestJSONL(dir string) string {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return ""
	}
	var bestID string
	var bestMtime int64
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".jsonl") {
			continue
		}
		fi, err := e.Info()
		if err != nil {
			continue
		}
		if fi.ModTime().UnixMilli() > bestMtime {
			bestMtime = fi.ModTime().UnixMilli()
			bestID = strings.TrimSuffix(e.Name(), ".jsonl")
		}
	}
	return bestID
}

func sanitizeClaudeProjectKey(cwd string) string {
	// Replace '/' with '-' and strip leading '-'
	key := strings.ReplaceAll(filepath.ToSlash(cwd), "/", "-")
	return strings.TrimLeft(key, "-")
}

var claudeAdapter = Adapter{
	Kind:     "claude",
	Binaries: []string{"claude"},
	ResumeArgs: func(id string) []string {
		return []string{"claude", "--resume", id}
	},
	FindLatest: func(cwd, home string) string {
		dir := filepath.Join(home, ".claude", "projects", sanitizeClaudeProjectKey(cwd))
		return newestJSONL(dir)
	},
}

var codexAdapter = Adapter{
	Kind:     "codex",
	Binaries: []string{"codex"},
	ResumeArgs: func(id string) []string {
		return []string{"codex", "resume", id}
	},
	FindLatest: func(_, home string) string {
		root := filepath.Join(home, ".codex", "sessions")
		var bestID string
		var bestMtime int64
		_ = filepath.Walk(root, func(path string, fi os.FileInfo, err error) error {
			if err != nil || fi.IsDir() || !strings.HasSuffix(path, ".jsonl") {
				return nil
			}
			base := strings.TrimSuffix(filepath.Base(path), ".jsonl")
			var id string
			if after, ok := strings.CutPrefix(base, "rollout-"); ok {
				id = after
			} else {
				id = base
			}
			if id != "" && fi.ModTime().UnixMilli() > bestMtime {
				bestMtime = fi.ModTime().UnixMilli()
				bestID = id
			}
			return nil
		})
		return bestID
	},
}

var geminiAdapter = Adapter{
	Kind:     "gemini",
	Binaries: []string{"gemini"},
	ResumeArgs: func(id string) []string {
		return []string{"gemini", "--resume", id}
	},
	FindLatest: func(cwd, home string) string {
		root := filepath.Join(home, ".gemini", "tmp")
		var bestID string
		var bestMtime int64
		_ = filepath.Walk(root, func(path string, fi os.FileInfo, err error) error {
			if err != nil || fi.IsDir() {
				return nil
			}
			if !strings.HasSuffix(filepath.Base(path), ".jsonl") {
				return nil
			}
			if fi.ModTime().UnixMilli() > bestMtime {
				bestMtime = fi.ModTime().UnixMilli()
				bestID = strings.TrimSuffix(filepath.Base(path), ".jsonl")
			}
			return nil
		})
		return bestID
	},
}

var cursorAdapter = Adapter{
	Kind:     "cursor",
	Binaries: []string{"agent", "cursor-agent"},
	ResumeArgs: func(id string) []string {
		return []string{"agent", "--resume", id}
	},
	FindLatest: func(cwd, home string) string {
		root := filepath.Join(home, ".cursor", "chats")
		var bestID string
		var bestMtime int64
		_ = filepath.Walk(root, func(path string, fi os.FileInfo, err error) error {
			if err != nil || fi.IsDir() {
				return nil
			}
			if fi.ModTime().UnixMilli() > bestMtime {
				bestMtime = fi.ModTime().UnixMilli()
				bestID = filepath.Dir(path)[strings.LastIndex(filepath.Dir(path), "/")+1:]
			}
			return nil
		})
		return bestID
	},
}

var Adapters = []Adapter{claudeAdapter, codexAdapter, geminiAdapter, cursorAdapter}

func DefaultHome() string {
	home, _ := os.UserHomeDir()
	return home
}

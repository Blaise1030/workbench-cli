package workspace

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

const maxFilePreviewBytes = 512 * 1024

var noiseDirs = map[string]bool{
	"node_modules": true,
	".git":         true,
	".next":        true,
	"dist":         true,
	".turbo":       true,
	".cache":       true,
	"__pycache__":  true,
	".venv":        true,
	".DS_Store":    true,
}

type FileError struct {
	Msg    string
	Status int
}

func (e *FileError) Error() string { return e.Msg }

func ListFiles(worktreePath string) ([]string, error) {
	var paths []string
	root, err := filepath.Abs(worktreePath)
	if err != nil {
		return nil, err
	}
	var walk func(string) error
	walk = func(dir string) error {
		entries, err := os.ReadDir(dir)
		if err != nil {
			return nil
		}
		for _, e := range entries {
			if noiseDirs[e.Name()] {
				continue
			}
			full := filepath.Join(dir, e.Name())
			if e.IsDir() {
				_ = walk(full)
			} else {
				rel, _ := filepath.Rel(root, full)
				paths = append(paths, filepath.ToSlash(rel))
			}
		}
		return nil
	}
	_ = walk(root)
	return paths, nil
}

type FileContent struct {
	Path      string `json:"path"`
	Content   string `json:"content"`
	Truncated bool   `json:"truncated"`
}

func ReadFile(worktreePath, relativePath string) (*FileContent, error) {
	normalized := strings.ReplaceAll(relativePath, "\\", "/")
	normalized = strings.TrimLeft(normalized, "/")
	if normalized == "" || strings.HasSuffix(normalized, "/") {
		return nil, &FileError{Msg: "Invalid file path", Status: 400}
	}
	abs, err := AssertPathWithinRoot(worktreePath, normalized)
	if err != nil {
		return nil, &FileError{Msg: err.Error(), Status: 400}
	}
	fi, err := os.Stat(abs)
	if err != nil {
		return nil, &FileError{Msg: "File not found", Status: 404}
	}
	if !fi.Mode().IsRegular() {
		return nil, &FileError{Msg: "Not a file", Status: 400}
	}
	truncated := fi.Size() > maxFilePreviewBytes
	readLen := fi.Size()
	if truncated {
		readLen = maxFilePreviewBytes
	}
	f, err := os.Open(abs)
	if err != nil {
		return nil, &FileError{Msg: "Cannot open file", Status: 400}
	}
	defer f.Close()
	buf := make([]byte, readLen)
	n, err := io.ReadFull(f, buf)
	if err != nil && err != io.ErrUnexpectedEOF {
		return nil, &FileError{Msg: "Read error", Status: 400}
	}
	buf = buf[:n]
	// Detect binary
	for _, b := range buf {
		if b == 0 {
			return nil, &FileError{Msg: "Binary file cannot be previewed", Status: 400}
		}
	}
	return &FileContent{Path: normalized, Content: string(buf), Truncated: truncated}, nil
}

// fuzzyScore returns a score > 0 if query matches path (subsequence match).
// Higher score = better match (consecutive chars and filename matches rank higher).
func fuzzyScore(path, query string) int {
	if query == "" {
		return 0
	}
	lPath := strings.ToLower(path)
	lQuery := strings.ToLower(query)

	// Check subsequence match
	pi, qi := 0, 0
	for pi < len(lPath) && qi < len(lQuery) {
		if lPath[pi] == lQuery[qi] {
			qi++
		}
		pi++
	}
	if qi < len(lQuery) {
		return 0 // not a match
	}

	score := 1
	// Bonus: query is a substring
	if strings.Contains(lPath, lQuery) {
		score += 10
	}
	// Bonus: filename (last segment) contains query as substring
	filename := strings.ToLower(filepath.Base(path))
	if strings.Contains(filename, lQuery) {
		score += 20
	}
	// Bonus: filename starts with query
	if strings.HasPrefix(filename, lQuery) {
		score += 10
	}
	return score
}

func SearchFiles(worktreePath, query string, limit int) ([]string, error) {
	all, err := ListFiles(worktreePath)
	if err != nil {
		return nil, err
	}
	type scored struct {
		path  string
		score int
	}
	var matches []scored
	for _, p := range all {
		if s := fuzzyScore(p, query); s > 0 {
			matches = append(matches, scored{p, s})
		}
	}
	// Sort by score descending
	for i := 0; i < len(matches); i++ {
		for j := i + 1; j < len(matches); j++ {
			if matches[j].score > matches[i].score {
				matches[i], matches[j] = matches[j], matches[i]
			}
		}
	}
	if limit > 0 && len(matches) > limit {
		matches = matches[:limit]
	}
	paths := make([]string, len(matches))
	for i, m := range matches {
		paths[i] = m.path
	}
	return paths, nil
}

func WriteFile(worktreePath, relativePath, content string) error {
	normalized := strings.ReplaceAll(relativePath, "\\", "/")
	normalized = strings.TrimLeft(normalized, "/")
	if normalized == "" || strings.HasSuffix(normalized, "/") {
		return &FileError{Msg: "Invalid file path", Status: 400}
	}
	abs, err := AssertPathWithinRoot(worktreePath, normalized)
	if err != nil {
		return &FileError{Msg: err.Error(), Status: 400}
	}
	fi, err := os.Stat(abs)
	if err != nil {
		return &FileError{Msg: "File not found", Status: 400}
	}
	if !fi.Mode().IsRegular() {
		return &FileError{Msg: "Not a file", Status: 400}
	}
	if err := os.WriteFile(abs, []byte(content), fi.Mode()); err != nil {
		return &FileError{Msg: fmt.Sprintf("Failed to write file: %s", err), Status: 400}
	}
	return nil
}

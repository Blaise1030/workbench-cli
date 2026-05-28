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

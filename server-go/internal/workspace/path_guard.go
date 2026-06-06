package workspace

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func AssertPathWithinRoot(root, relativePath string) (string, error) {
	resolvedRoot, err := filepath.Abs(root)
	if err != nil {
		return "", err
	}
	resolvedPath, err := filepath.Abs(filepath.Join(resolvedRoot, relativePath))
	if err != nil {
		return "", err
	}
	rel, err := filepath.Rel(resolvedRoot, resolvedPath)
	if err != nil {
		return "", err
	}
	if rel == "" || (!strings.HasPrefix(rel, "..") && !filepath.IsAbs(rel)) {
		return resolvedPath, nil
	}
	return "", fmt.Errorf("path escapes worktree: %q resolves outside %q", relativePath, resolvedRoot)
}

// resolveExistingDirectory normalizes a user-selected folder to an absolute path and
// verifies it exists on disk as a directory.
func resolveExistingDirectory(pathInput string) (string, error) {
	if strings.Contains(pathInput, "\x00") {
		return "", fmt.Errorf("invalid path")
	}
	abs, err := filepath.Abs(pathInput)
	if err != nil {
		return "", err
	}
	clean := filepath.Clean(abs)
	// codeql[go/path-injection] -- local workspace tool; path is Abs+Clean validated before stat
	info, err := os.Stat(clean)
	if err != nil {
		return "", err
	}
	if !info.IsDir() {
		return "", fmt.Errorf("path is not a directory")
	}
	return clean, nil
}

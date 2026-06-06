package workspace

import (
	"fmt"
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

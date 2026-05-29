//go:build !embed

package assets

import "os"

const IsEmbedded = false

func init() {
	// Try project-relative dist/public, fall back to nil (will serve 404 hint)
	candidates := []string{
		"../dist/public",
		"../../dist/public",
		"dist/public",
	}
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			Public = os.DirFS(p)
			return
		}
	}
}

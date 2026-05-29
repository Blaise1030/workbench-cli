package assets

import (
	"io"
	"io/fs"
	"net/http"
	"strings"
)

// Handler returns an http.Handler that serves static files from Public FS.
// Non-/api/* paths that don't match a static file fall through to index.html (SPA).
func Handler() http.Handler {
	if Public == nil {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "Frontend not built. Run: npm run build", http.StatusNotFound)
		})
	}

	sub, err := fs.Sub(Public, ".")
	if err != nil {
		panic("assets: invalid FS: " + err.Error())
	}
	fileServer := http.FileServer(http.FS(sub))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}

		upath := strings.TrimPrefix(r.URL.Path, "/")

		// Serve static assets directly — but skip index.html, because http.FileServer
		// redirects any request for */index.html to its parent directory (./)
		// which would create an infinite redirect loop for SPA routes.
		if upath != "" && upath != "index.html" {
			f, openErr := sub.Open(upath)
			if openErr == nil {
				info, statErr := f.Stat()
				f.Close()
				// Only use the file server for regular files; let directories fall
				// through to the SPA so we don't get a trailing-slash redirect.
				if statErr == nil && !info.IsDir() {
					fileServer.ServeHTTP(w, r)
					return
				}
			}
		}

		// SPA fallback: serve index.html directly to avoid FileServer's redirect.
		serveIndex(w, r, sub)
	})
}

func serveIndex(w http.ResponseWriter, r *http.Request, sub fs.FS) {
	f, err := sub.Open("index.html")
	if err != nil {
		http.Error(w, "Frontend not built. Run: npm run build", http.StatusNotFound)
		return
	}
	defer f.Close()
	stat, err := f.Stat()
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	rs, ok := f.(io.ReadSeeker)
	if !ok {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	http.ServeContent(w, r, "index.html", stat.ModTime(), rs)
}

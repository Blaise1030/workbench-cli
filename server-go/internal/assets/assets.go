package assets

import (
	"io/fs"
	"net/http"
	"net/url"
	"strings"
)

// Handler returns an http.Handler that serves static files from Public FS.
// Non-/api/* paths that don't match a file fall through to index.html (SPA).
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

		f, openErr := sub.Open(strings.TrimPrefix(r.URL.Path, "/"))
		if openErr == nil {
			f.Close()
			fileServer.ServeHTTP(w, r)
			return
		}

		// SPA fallback: rewrite path to /index.html
		r2 := new(http.Request)
		*r2 = *r
		r2.URL = new(url.URL)
		*r2.URL = *r.URL
		r2.URL.Path = "/index.html"
		fileServer.ServeHTTP(w, r2)
	})
}

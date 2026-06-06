package sidecar

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
)

const (
	scriptTag  = `<script src="/sidecar/client.js"></script>`
	cookieName = "__sidecar_target"
	cookiePath = "/sidecar/proxy"
)

// NewProxyHandler returns an http.Handler that:
//   - On first load (target query param present): stores target in a cookie and proxies the root.
//   - On asset requests (cookie present, path under /sidecar/proxy/*): proxies to the stored target.
//
// HTML responses have:
//  1. Absolute-path src="/" and href="/" attributes rewritten to /sidecar/proxy/ so that
//     asset requests stay under the proxy path prefix (where the cookie applies).
//  2. client.js injected before </body>.
//
// Only localhost targets are accepted.
func NewProxyHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		target := ""

		if t := r.URL.Query().Get("target"); t != "" {
			if !isLocalhostURL(t) {
				http.Error(w, "target must be a localhost URL", http.StatusBadRequest)
				return
			}
			target = t
			http.SetCookie(w, &http.Cookie{
				Name:     cookieName,
				Value:    target,
				Path:     cookiePath,
				SameSite: http.SameSiteStrictMode,
			})
		} else if c, err := r.Cookie(cookieName); err == nil {
			target = c.Value
		}

		if target == "" {
			http.Error(w, "target query param required", http.StatusBadRequest)
			return
		}

		targetURL, err := url.Parse(target)
		if err != nil {
			http.Error(w, "invalid target URL", http.StatusBadRequest)
			return
		}

		// Strip /sidecar/proxy prefix to get the subpath for the target
		subpath := strings.TrimPrefix(r.URL.Path, "/sidecar/proxy")
		if subpath == "" {
			subpath = "/"
		}

		proxy := httputil.NewSingleHostReverseProxy(targetURL)
		proxy.ModifyResponse = injectClientScript

		r2 := r.Clone(r.Context())
		r2.URL = &url.URL{
			Scheme:   targetURL.Scheme,
			Host:     targetURL.Host,
			Path:     subpath,
			RawQuery: r.URL.RawQuery,
		}
		r2.Host = targetURL.Host

		proxy.ServeHTTP(w, r2)
	})
}

func isLocalhostURL(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil {
		return false
	}
	host := u.Hostname()
	return host == "localhost" || host == "127.0.0.1" || host == "::1"
}

func injectClientScript(resp *http.Response) error {
	ct := resp.Header.Get("Content-Type")
	if !strings.Contains(ct, "text/html") {
		return nil
	}

	body, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil {
		return err
	}

	// Rewrite absolute-path asset references so requests stay under /sidecar/proxy/
	// and carry the target cookie. Handles <script src="/..."> and <link href="/...">
	// but not JS-level fetch('/...') calls (v1 limitation).
	body = bytes.ReplaceAll(body, []byte(`src="/`), []byte(`src="/sidecar/proxy/`))
	body = bytes.ReplaceAll(body, []byte(`href="/`), []byte(`href="/sidecar/proxy/`))

	// Inject script tag AFTER rewriting so it doesn't get double-rewritten
	script := []byte(scriptTag)
	closeBody := []byte("</body>")
	if idx := bytes.Index(body, closeBody); idx >= 0 {
		modified := make([]byte, 0, len(body)+len(script))
		modified = append(modified, body[:idx]...)
		modified = append(modified, script...)
		modified = append(modified, body[idx:]...)
		body = modified
	} else {
		body = append(body, script...)
	}

	resp.Body = io.NopCloser(bytes.NewReader(body))
	resp.ContentLength = int64(len(body))
	resp.Header.Del("Content-Length")
	resp.Header.Del("Content-Encoding")
	return nil
}

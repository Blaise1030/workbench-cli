package sidecar

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestInjectClientScript_injectsBeforeBody(t *testing.T) {
	body := `<html><head></head><body><p>Hello</p></body></html>`
	resp := &http.Response{
		Header: http.Header{"Content-Type": []string{"text/html; charset=utf-8"}},
		Body:   io.NopCloser(strings.NewReader(body)),
	}

	if err := injectClientScript(resp); err != nil {
		t.Fatal(err)
	}
	out, _ := io.ReadAll(resp.Body)
	if !strings.Contains(string(out), `<script src="/sidecar/client.js"></script></body>`) {
		t.Errorf("script not injected before </body>: %s", out)
	}
}

func TestInjectClientScript_appendsWhenNoBodyTag(t *testing.T) {
	body := `<html><p>No closing body</p></html>`
	resp := &http.Response{
		Header: http.Header{"Content-Type": []string{"text/html"}},
		Body:   io.NopCloser(strings.NewReader(body)),
	}

	if err := injectClientScript(resp); err != nil {
		t.Fatal(err)
	}
	out, _ := io.ReadAll(resp.Body)
	if !strings.HasSuffix(strings.TrimSpace(string(out)), `<script src="/sidecar/client.js"></script>`) {
		t.Errorf("script not appended: %s", out)
	}
}

func TestInjectClientScript_rewritesAbsolutePaths(t *testing.T) {
	body := `<html><head><link href="/styles.css"></head><body><script src="/src/main.ts"></script></body></html>`
	resp := &http.Response{
		Header: http.Header{"Content-Type": []string{"text/html"}},
		Body:   io.NopCloser(strings.NewReader(body)),
	}

	if err := injectClientScript(resp); err != nil {
		t.Fatal(err)
	}
	out, _ := io.ReadAll(resp.Body)
	s := string(out)
	if !strings.Contains(s, `href="/sidecar/proxy/styles.css"`) {
		t.Errorf("href not rewritten: %s", s)
	}
	if !strings.Contains(s, `src="/sidecar/proxy/src/main.ts"`) {
		t.Errorf("src not rewritten: %s", s)
	}
	// client.js src should NOT be double-rewritten
	if strings.Contains(s, `/sidecar/proxy/sidecar/`) {
		t.Errorf("client.js script tag was incorrectly rewritten: %s", s)
	}
}

func TestInjectClientScript_skipsNonHTML(t *testing.T) {
	body := `console.log("hello")`
	resp := &http.Response{
		Header: http.Header{"Content-Type": []string{"application/javascript"}},
		Body:   io.NopCloser(strings.NewReader(body)),
	}

	if err := injectClientScript(resp); err != nil {
		t.Fatal(err)
	}
	out, _ := io.ReadAll(resp.Body)
	if strings.Contains(string(out), "sidecar") {
		t.Errorf("script injected into non-HTML response")
	}
}

func TestProxyHandler_requiresTarget(t *testing.T) {
	handler := NewProxyHandler()
	req := httptest.NewRequest("GET", "/sidecar/proxy", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestProxyHandler_rejectsNonLocalhost(t *testing.T) {
	handler := NewProxyHandler()
	req := httptest.NewRequest("GET", "/sidecar/proxy?target=http://evil.com", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for non-localhost target, got %d", w.Code)
	}
}

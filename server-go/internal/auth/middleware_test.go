package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func okHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
}

func TestRequireOrigin_AllowsMatchingHost(t *testing.T) {
	h := RequireOrigin("localhost:4739")(okHandler())
	req := httptest.NewRequest(http.MethodPost, "/", nil)
	req.Header.Set("Origin", "http://localhost:4739")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}
}

func TestRequireOrigin_BlocksForeignOrigin(t *testing.T) {
	h := RequireOrigin("localhost:4739")(okHandler())
	req := httptest.NewRequest(http.MethodPost, "/", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", rr.Code)
	}
}

func TestRequireOrigin_BlocksMissingOriginOnPost(t *testing.T) {
	h := RequireOrigin("localhost:4739")(okHandler())
	req := httptest.NewRequest(http.MethodPost, "/", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Errorf("expected 403 for missing Origin on POST, got %d", rr.Code)
	}
}

func TestRequireOrigin_AllowsGetWithoutOrigin(t *testing.T) {
	h := RequireOrigin("localhost:4739")(okHandler())
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 for GET without Origin, got %d", rr.Code)
	}
}

func TestRequireOrigin_AllowsSecondHost(t *testing.T) {
	h := RequireOrigin("localhost:4739", "127.0.0.1:4739")(okHandler())
	req := httptest.NewRequest(http.MethodPost, "/", nil)
	req.Header.Set("Origin", "http://127.0.0.1:4739")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 for second allowed host, got %d", rr.Code)
	}
}

func TestRequireOrigin_BlocksNullOrigin(t *testing.T) {
	h := RequireOrigin("localhost:4739")(okHandler())
	req := httptest.NewRequest(http.MethodPost, "/", nil)
	req.Header.Set("Origin", "null")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Errorf("expected 403 for null origin, got %d", rr.Code)
	}
}

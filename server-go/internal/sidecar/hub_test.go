package sidecar

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestProcessIncoming_passesThrough(t *testing.T) {
	h := NewHub(t.TempDir())
	raw := []byte(`{"type":"refresh"}`)
	got := h.processIncoming(raw)
	if string(got) != string(raw) {
		t.Fatalf("expected passthrough, got %s", got)
	}
}

func TestProcessIncoming_savesScreenshot(t *testing.T) {
	dir := t.TempDir()
	h := NewHub(dir)

	// 1x1 red PNG base64
	pngB64 := "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg=="
	msg := map[string]string{
		"type":       "element-selected",
		"selector":   ".foo > p",
		"screenshot": pngB64,
	}
	raw, _ := json.Marshal(msg)

	out := h.processIncoming(raw)

	var result map[string]string
	if err := json.Unmarshal(out, &result); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if _, ok := result["screenshot"]; ok {
		t.Error("screenshot field should be removed")
	}
	path, ok := result["screenshotPath"]
	if !ok {
		t.Fatal("screenshotPath missing")
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("screenshot file not found at %s: %v", path, err)
	}
	if filepath.Ext(path) != ".png" {
		t.Errorf("expected .png extension, got %s", filepath.Ext(path))
	}
	if result["selector"] != ".foo > p" {
		t.Errorf("selector modified unexpectedly: %s", result["selector"])
	}
}

func TestProcessIncoming_invalidBase64(t *testing.T) {
	h := NewHub(t.TempDir())
	raw := []byte(`{"type":"element-selected","selector":".a","screenshot":"!!!notbase64!!!"}`)
	out := h.processIncoming(raw)
	// should return original message unchanged
	if string(out) != string(raw) {
		t.Fatalf("expected original on bad base64, got %s", out)
	}
}

# Preview Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A proxy-based live preview tab that the IDE opens via Cmd+click on terminal URLs, stays in sync with file saves, and lets you select elements to paste their CSS selector + screenshot path into the active terminal.

**Architecture:** A new `sidecar-client` pnpm package builds a self-contained `client.js` (VanJS + html2canvas) that gets embedded into the Go binary. The Go server adds three endpoints: a cookie-based reverse proxy that injects `client.js` into HTML responses, a static handler for `client.js`, and a WebSocket hub that relays messages between the IDE tab and the proxy tab. The frontend terminal gains a URL link provider so normal-click opens direct and Cmd+click opens via proxy.

**Tech Stack:** Go (`net/http/httputil`, `github.com/coder/websocket`), TypeScript, VanJS 1.x, html2canvas, Vite lib mode, xterm.js `ILinkProvider`

---

## File Map

**New files — sidecar-client package**
- `sidecar-client/package.json` — package manifest, `@browser-sidecar/sidecar-client`
- `sidecar-client/vite.config.ts` — lib mode, iife, single entry
- `sidecar-client/tsconfig.json` — strict TypeScript
- `sidecar-client/src/selector.ts` — CSS selector capture (pure, testable)
- `sidecar-client/src/selector.test.ts` — vitest unit tests
- `sidecar-client/src/pill.ts` — VanJS pill in Shadow DOM
- `sidecar-client/src/screenshot.ts` — html2canvas element screenshot
- `sidecar-client/src/index.ts` — WS client + selection logic entry

**New files — Go sidecar package**
- `server-go/internal/sidecar/hub.go` — WS hub, screenshot interception
- `server-go/internal/sidecar/hub_test.go` — hub unit tests
- `server-go/internal/sidecar/proxy.go` — cookie-based reverse proxy + HTML injection
- `server-go/internal/sidecar/proxy_test.go` — proxy injection tests
- `server-go/internal/sidecar/embed.go` — `//go:embed` for client.js
- `server-go/internal/sidecar/routes.go` — `RegisterRoutes(r, hub)`
- `server-go/internal/sidecar/static/client.js` — placeholder (overwritten by build)

**New files — frontend**
- `frontend/src/modules/terminal/lib/terminal-url-links.ts` — URL link provider (pure)
- `frontend/src/modules/terminal/lib/terminal-url-links.test.ts` — vitest tests
- `frontend/src/modules/terminal/lib/sidecar-ws.ts` — singleton WS composable

**Modified files**
- `pnpm-workspace.yaml` — add `sidecar-client`
- `package.json` — prepend sidecar-client build to `build` script
- `scripts/build-go.mjs` — copy `sidecar-client/dist/client.js` → `server-go/internal/sidecar/static/client.js`
- `server-go/internal/api/router.go` — create hub, register sidecar routes, pass hub to workspace routes
- `server-go/internal/workspace/router.go` — accept hub, call `hub.BroadcastRefresh()` after file write
- `frontend/src/modules/terminal/pages/Terminal.vue` — register URL link provider, init sidecar WS, handle element-selected

---

## Task 1: sidecar-client package scaffold

**Files:**
- Create: `sidecar-client/package.json`
- Create: `sidecar-client/vite.config.ts`
- Create: `sidecar-client/tsconfig.json`
- Modify: `pnpm-workspace.yaml`

- [ ] **Step 1: Add sidecar-client to workspace**

Edit `pnpm-workspace.yaml`:
```yaml
packages:
  - frontend
  - cli
  - landing
  - sidecar-client
allowBuilds:
  esbuild: true
  sharp: true
  vue-demi: true
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "@browser-sidecar/sidecar-client",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "html2canvas": "^1.4.1",
    "vanjs-core": "^1.6.0"
  },
  "devDependencies": {
    "typescript": "^5.8.3",
    "vite": "^6.3.5",
    "vitest": "^3.1.3"
  }
}
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      name: "SidecarClient",
      formats: ["iife"],
      fileName: () => "client.js",
    },
    outDir: "dist",
    minify: true,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
```

- [ ] **Step 4: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "lib": ["ES2020", "DOM"],
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Install dependencies**

```bash
pnpm install
```

Expected: packages installed, `sidecar-client` appears in workspace.

- [ ] **Step 6: Commit**

```bash
git add pnpm-workspace.yaml sidecar-client/
git commit -m "chore: scaffold sidecar-client package"
```

---

## Task 2: CSS selector capture

**Files:**
- Create: `sidecar-client/src/selector.ts`
- Create: `sidecar-client/src/selector.test.ts`

- [ ] **Step 1: Write the failing test**

Create `sidecar-client/src/selector.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { buildSelector } from "./selector";

function el(tag: string, attrs: Record<string, string> = {}): Element {
  const e = document.createElement(tag);
  if (attrs.id) e.id = attrs.id;
  if (attrs.class) e.className = attrs.class;
  return e;
}

describe("buildSelector", () => {
  it("returns tag name for element with no id or classes", () => {
    expect(buildSelector(el("div"))).toBe("div");
  });

  it("stops at id and uses #id", () => {
    const e = el("div", { id: "main" });
    expect(buildSelector(e)).toBe("#main");
  });

  it("includes stable class names", () => {
    const e = el("button", { class: "btn primary" });
    expect(buildSelector(e)).toBe("button.btn.primary");
  });

  it("skips dynamic CSS-module-like class names", () => {
    // matches /^[a-z]+-[a-z0-9]{4,}$/i
    const e = el("div", { class: "card-header abc-1234 stable" });
    expect(buildSelector(e)).toBe("div.card-header.stable");
  });

  it("limits to first two stable classes", () => {
    const e = el("div", { class: "a b c d" });
    expect(buildSelector(e)).toBe("div.a.b");
  });

  it("walks ancestor chain up to body", () => {
    const parent = el("section", { class: "container" });
    const child = el("p");
    parent.appendChild(child);
    document.body.appendChild(parent);
    expect(buildSelector(child)).toBe("section.container > p");
    document.body.removeChild(parent);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd sidecar-client && pnpm test
```
Expected: FAIL — `buildSelector` not found.

- [ ] **Step 3: Implement selector.ts**

Create `sidecar-client/src/selector.ts`:
```typescript
const DYNAMIC_CLASS_RE = /^[a-z]+-[a-z0-9]{4,}$/i;

export function buildSelector(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.body) {
    if (current.id) {
      parts.unshift(`#${current.id}`);
      break;
    }

    const tag = current.tagName.toLowerCase();
    const stableClasses = Array.from(current.classList)
      .filter((c) => !DYNAMIC_CLASS_RE.test(c))
      .slice(0, 2);

    const segment =
      stableClasses.length > 0 ? `${tag}.${stableClasses.join(".")}` : tag;
    parts.unshift(segment);
    current = current.parentElement;
  }

  return parts.join(" > ") || el.tagName.toLowerCase();
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd sidecar-client && pnpm test
```
Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add sidecar-client/src/selector.ts sidecar-client/src/selector.test.ts
git commit -m "feat(sidecar-client): add CSS selector capture"
```

---

## Task 3: Selection pill (VanJS + Shadow DOM)

**Files:**
- Create: `sidecar-client/src/pill.ts`

- [ ] **Step 1: Create pill.ts**

```typescript
import van from "vanjs-core";

const PILL_STYLES = `
  :host { all: initial; }
  .pill {
    display: flex; align-items: center; gap: 8px;
    background: #1e1e2e; border-radius: 6px;
    padding: 6px 12px; cursor: pointer;
    font-family: monospace; font-size: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    user-select: none;
  }
  .dot {
    width: 8px; height: 8px; border-radius: 50%;
    transition: background 0.15s;
  }
  .dot.off { background: #6c7086; }
  .dot.on  { background: #a6e3a1; }
  .label   { color: #cdd6f4; }
`;

export interface Pill {
  setActive(v: boolean): void;
}

export function mountPill(onToggle: (active: boolean) => void): Pill {
  const { div, span, style } = van.tags;
  const active = van.state(false);

  const host = document.createElement("div");
  host.setAttribute("data-sidecar-pill", "");
  host.style.cssText =
    "position:fixed;bottom:16px;left:16px;z-index:2147483647;pointer-events:auto";
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  const pill = div(
    {
      class: "pill",
      onclick: () => {
        active.val = !active.val;
        onToggle(active.val);
      },
    },
    span({ class: () => `dot ${active.val ? "on" : "off"}` }),
    span({ class: "label" }, "Select"),
  );

  van.add(shadow, style(PILL_STYLES), pill);

  return {
    setActive(v: boolean) {
      active.val = v;
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add sidecar-client/src/pill.ts
git commit -m "feat(sidecar-client): add VanJS selection pill with shadow DOM"
```

---

## Task 4: Screenshot capture

**Files:**
- Create: `sidecar-client/src/screenshot.ts`

- [ ] **Step 1: Create screenshot.ts**

```typescript
import html2canvas from "html2canvas";

export async function captureScreenshot(el: HTMLElement): Promise<string> {
  const rect = el.getBoundingClientRect();
  const canvas = await html2canvas(document.body, {
    x: rect.left + window.scrollX,
    y: rect.top + window.scrollY,
    width: rect.width,
    height: rect.height,
    useCORS: true,
    logging: false,
  });
  // Remove the "data:image/png;base64," prefix — Go decodes raw base64
  return canvas.toDataURL("image/png").split(",")[1] ?? "";
}
```

- [ ] **Step 2: Commit**

```bash
git add sidecar-client/src/screenshot.ts
git commit -m "feat(sidecar-client): add element screenshot capture"
```

---

## Task 5: client.js entry point

**Files:**
- Create: `sidecar-client/src/index.ts`

- [ ] **Step 1: Create index.ts**

```typescript
import { mountPill } from "./pill";
import { buildSelector } from "./selector";
import { captureScreenshot } from "./screenshot";

const WS_URL = (() => {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/sidecar/ws`;
})();

let ws: WebSocket | null = null;
let selectionActive = false;

function connect() {
  ws = new WebSocket(WS_URL);
  ws.addEventListener("message", (e) => {
    try {
      const msg = JSON.parse(e.data as string) as { type: string };
      if (msg.type === "refresh") location.reload();
    } catch {
      // ignore malformed messages
    }
  });
  ws.addEventListener("close", () => setTimeout(connect, 2000));
}

function onMouseOver(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target.closest("[data-sidecar-pill]")) return;
  target.style.outline = "2px solid #89b4fa";
}

function onMouseOut(e: MouseEvent) {
  (e.target as HTMLElement).style.outline = "";
}

async function onClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target.closest("[data-sidecar-pill]")) return;
  e.preventDefault();
  e.stopPropagation();

  const selector = buildSelector(target);
  const screenshot = await captureScreenshot(target);

  ws?.send(JSON.stringify({ type: "element-selected", selector, screenshot }));

  selectionActive = false;
  pill.setActive(false);
  document.removeEventListener("mouseover", onMouseOver);
  document.removeEventListener("mouseout", onMouseOut);
  document.removeEventListener("click", onClick, true);
}

const pill = mountPill((active) => {
  selectionActive = active;
  if (active) {
    document.addEventListener("mouseover", onMouseOver);
    document.addEventListener("mouseout", onMouseOut);
    document.addEventListener("click", onClick, true);
  } else {
    document.removeEventListener("mouseover", onMouseOver);
    document.removeEventListener("mouseout", onMouseOut);
    document.removeEventListener("click", onClick, true);
  }
});

connect();
```

- [ ] **Step 2: Build and verify**

```bash
cd sidecar-client && pnpm build
```
Expected: `sidecar-client/dist/client.js` created, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add sidecar-client/src/index.ts sidecar-client/dist/
git commit -m "feat(sidecar-client): add WS client entry with selection mode"
```

---

## Task 6: Go WebSocket hub

**Files:**
- Create: `server-go/internal/sidecar/hub.go`
- Create: `server-go/internal/sidecar/hub_test.go`

- [ ] **Step 1: Write the failing test**

Create `server-go/internal/sidecar/hub_test.go`:
```go
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server-go && go test ./internal/sidecar/...
```
Expected: compile error — package does not exist.

- [ ] **Step 3: Implement hub.go**

Create `server-go/internal/sidecar/hub.go`:
```go
package sidecar

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"sync"

	"github.com/coder/websocket"
	"github.com/google/uuid"
)

type hubClient struct {
	send chan []byte
	done chan struct{}
}

// Hub relays messages between the IDE tab and the proxy tab.
// It intercepts element-selected messages to persist screenshots to disk.
type Hub struct {
	mu      sync.RWMutex
	clients map[*hubClient]struct{}
	dataDir string // directory where screenshot files are saved
}

func NewHub(dataDir string) *Hub {
	return &Hub{
		clients: make(map[*hubClient]struct{}),
		dataDir: dataDir,
	}
}

func (h *Hub) add(c *hubClient) {
	h.mu.Lock()
	h.clients[c] = struct{}{}
	h.mu.Unlock()
}

func (h *Hub) remove(c *hubClient) {
	h.mu.Lock()
	delete(h.clients, c)
	h.mu.Unlock()
	close(c.done)
}

func (h *Hub) broadcast(msg []byte, exclude *hubClient) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients {
		if c == exclude {
			continue
		}
		select {
		case c.send <- msg:
		default:
		}
	}
}

// BroadcastRefresh sends {"type":"refresh"} to all connected clients.
func (h *Hub) BroadcastRefresh() {
	h.broadcast([]byte(`{"type":"refresh"}`), nil)
}

// processIncoming intercepts element-selected messages: saves the base64 screenshot
// to dataDir/files/<uuid>.png and replaces the screenshot field with screenshotPath.
// All other message types are returned unchanged.
func (h *Hub) processIncoming(raw []byte) []byte {
	var m map[string]json.RawMessage
	if err := json.Unmarshal(raw, &m); err != nil {
		return raw
	}
	var msgType string
	if err := json.Unmarshal(m["type"], &msgType); err != nil {
		return raw
	}
	if msgType != "element-selected" {
		return raw
	}

	screenshotRaw, ok := m["screenshot"]
	if !ok {
		return raw
	}
	var b64 string
	if err := json.Unmarshal(screenshotRaw, &b64); err != nil || b64 == "" {
		return raw
	}

	data, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		slog.Warn("sidecar: invalid screenshot base64", "err", err)
		return raw
	}

	dir := filepath.Join(h.dataDir, "files")
	if err := os.MkdirAll(dir, 0755); err != nil {
		slog.Warn("sidecar: cannot create files dir", "err", err)
		return raw
	}

	fname := fmt.Sprintf("%s.png", uuid.New().String())
	fpath := filepath.Join(dir, fname)
	if err := os.WriteFile(fpath, data, 0644); err != nil {
		slog.Warn("sidecar: cannot write screenshot", "err", err)
		return raw
	}

	delete(m, "screenshot")
	fpathJSON, _ := json.Marshal(fpath)
	m["screenshotPath"] = fpathJSON

	enriched, err := json.Marshal(m)
	if err != nil {
		return raw
	}
	return enriched
}

// ServeWS upgrades the request to a WebSocket connection and joins the hub.
func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		InsecureSkipVerify: true,
	})
	if err != nil {
		slog.Error("sidecar ws accept", "err", err)
		return
	}

	c := &hubClient{
		send: make(chan []byte, 64),
		done: make(chan struct{}),
	}
	h.add(c)

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	go func() {
		defer conn.Close(websocket.StatusNormalClosure, "")
		for {
			select {
			case msg := <-c.send:
				if err := conn.Write(ctx, websocket.MessageText, msg); err != nil {
					return
				}
			case <-c.done:
				return
			case <-ctx.Done():
				return
			}
		}
	}()

	for {
		_, msg, err := conn.Read(ctx)
		if err != nil {
			break
		}
		outgoing := h.processIncoming(msg)
		h.broadcast(outgoing, c)
	}

	h.remove(c)
}
```

- [ ] **Step 4: Run tests**

```bash
cd server-go && go test ./internal/sidecar/...
```
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server-go/internal/sidecar/hub.go server-go/internal/sidecar/hub_test.go
git commit -m "feat(go): add sidecar WebSocket hub with screenshot persistence"
```

---

## Task 7: Go reverse proxy with HTML injection

**Files:**
- Create: `server-go/internal/sidecar/proxy.go`
- Create: `server-go/internal/sidecar/proxy_test.go`

- [ ] **Step 1: Write the failing test**

Create `server-go/internal/sidecar/proxy_test.go`:
```go
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server-go && go test ./internal/sidecar/...
```
Expected: FAIL — `injectClientScript`, `NewProxyHandler` not defined.

- [ ] **Step 3: Implement proxy.go**

Create `server-go/internal/sidecar/proxy.go`:
```go
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
//   1. Absolute-path src="/" and href="/" attributes rewritten to /sidecar/proxy/ so that
//      asset requests stay under the proxy path prefix (where the cookie applies).
//   2. client.js injected before </body>.
//
// V1 limitation: only src/href attributes in HTML are rewritten. JS fetch('/...') calls
// from the app will hit the sidecar, not the target. This works for most Vite/Next.js
// initial page loads; dynamic API calls require a future full-rewrite pass or service worker.
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
```

- [ ] **Step 4: Run tests**

```bash
cd server-go && go test ./internal/sidecar/...
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server-go/internal/sidecar/proxy.go server-go/internal/sidecar/proxy_test.go
git commit -m "feat(go): add sidecar reverse proxy with HTML injection"
```

---

## Task 8: Go embed, routes, and wire into API

**Files:**
- Create: `server-go/internal/sidecar/static/client.js` (placeholder)
- Create: `server-go/internal/sidecar/embed.go`
- Create: `server-go/internal/sidecar/routes.go`
- Modify: `server-go/internal/api/router.go`
- Modify: `server-go/internal/workspace/router.go`

- [ ] **Step 1: Create placeholder client.js for embed**

```bash
mkdir -p server-go/internal/sidecar/static
echo "// placeholder — overwritten by pnpm build" > server-go/internal/sidecar/static/client.js
```

- [ ] **Step 2: Create embed.go**

Create `server-go/internal/sidecar/embed.go`:
```go
package sidecar

import _ "embed"

//go:embed static/client.js
var ClientJS []byte
```

- [ ] **Step 3: Create routes.go**

Create `server-go/internal/sidecar/routes.go`:
```go
package sidecar

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// RegisterRoutes mounts all sidecar endpoints under /sidecar.
func RegisterRoutes(r chi.Router, hub *Hub) {
	r.Get("/sidecar/client.js", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write(ClientJS)
	})

	r.HandleFunc("/sidecar/ws", hub.ServeWS)

	r.Handle("/sidecar/proxy", NewProxyHandler())
	r.Handle("/sidecar/proxy/*", NewProxyHandler())
}
```

- [ ] **Step 4: Add hub + sidecar routes to api/router.go**

In `server-go/internal/api/router.go`, add the import and register routes.

Add to imports:
```go
"github.com/blaisetiong/workbench-cli/server-go/internal/config"
"github.com/blaisetiong/workbench-cli/server-go/internal/sidecar"
```

Change `RegisterRoutes` signature to accept and thread the hub:
```go
func RegisterRoutes(r *chi.Mux, version string, state *appstate.AppState, cookieSecure bool, registry *terminal.Registry, allowedHosts []string) {
    hub := sidecar.NewHub(config.DataDir())

    // ... existing r.Route("/api", ...) block unchanged ...

    r.Handle("/ws", terminal.WSHandler(state.Session, state.DB, registry))
    sidecar.RegisterRoutes(r, hub)                          // ← add this line
    workspace.RegisterRoutesWithHub(r, state.DB, state.Session, state.EventBus, hub) // ← replace workspace call
    r.Handle("/*", assets.Handler())
}
```

> **Note:** The workspace routes call is renamed in the next step. Keep the existing `workspace.RegisterRoutes` call for the `/api` group; only the hub-aware variant is needed for the file-write broadcast.

Actually — the workspace routes are registered inside `r.Route("/api", ...)` at the end:
```go
r.Group(func(r chi.Router) {
    workspace.RegisterRoutes(r, state.DB, state.Session, state.EventBus)
})
```

Change this to:
```go
r.Group(func(r chi.Router) {
    workspace.RegisterRoutes(r, state.DB, state.Session, state.EventBus, hub)
})
```

And add `sidecar.RegisterRoutes(r, hub)` after the `/api` block:
```go
r.Handle("/ws", terminal.WSHandler(state.Session, state.DB, registry))
sidecar.RegisterRoutes(r, hub)
r.Handle("/*", assets.Handler())
```

- [ ] **Step 5: Update workspace.RegisterRoutes to accept hub**

In `server-go/internal/workspace/router.go`, update the function signature:

Find:
```go
func RegisterRoutes(r chi.Router, db *sql.DB, session *auth.Session, bus *events.Bus) {
```

Replace with:
```go
type Refresher interface {
    BroadcastRefresh()
}

func RegisterRoutes(r chi.Router, db *sql.DB, session *auth.Session, bus *events.Bus, refresher ...Refresher) {
```

Using a variadic `refresher` keeps the signature backwards-compatible with any tests that call it without the hub.

Then in the `PUT /worktrees/{id}/files/content` handler, after `jsonResp(w, map[string]bool{"ok": true}, http.StatusOK)`:

Find the success branch:
```go
        if err := WriteFile(wt.Path, body.Path, body.Content); err != nil {
            wsErr(w, err.Error(), domainStatus(err))
            return
        }
        jsonResp(w, map[string]bool{"ok": true}, http.StatusOK)
```

Replace with:
```go
        if err := WriteFile(wt.Path, body.Path, body.Content); err != nil {
            wsErr(w, err.Error(), domainStatus(err))
            return
        }
        jsonResp(w, map[string]bool{"ok": true}, http.StatusOK)
        for _, rf := range refresher {
            rf.BroadcastRefresh()
        }
```

- [ ] **Step 6: Build Go to verify it compiles**

```bash
cd server-go && go build ./...
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add server-go/internal/sidecar/ server-go/internal/api/router.go server-go/internal/workspace/router.go
git commit -m "feat(go): add sidecar routes, embed client.js, broadcast refresh on file write"
```

---

## Task 9: Terminal URL link provider

**Files:**
- Create: `frontend/src/modules/terminal/lib/terminal-url-links.ts`
- Create: `frontend/src/modules/terminal/lib/terminal-url-links.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/modules/terminal/lib/terminal-url-links.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { extractURLs } from "./terminal-url-links";

describe("extractURLs", () => {
  it("returns empty for lines with no URLs", () => {
    expect(extractURLs("no urls here")).toEqual([]);
  });

  it("detects a simple localhost URL", () => {
    const results = extractURLs("  ➜  Local:   http://localhost:5173/");
    expect(results).toHaveLength(1);
    expect(results[0]!.url).toBe("http://localhost:5173/");
  });

  it("detects https URLs", () => {
    const results = extractURLs("  ➜  Local:   https://localhost:3000");
    expect(results).toHaveLength(1);
    expect(results[0]!.url).toBe("https://localhost:3000");
  });

  it("detects 127.0.0.1 URLs", () => {
    const results = extractURLs("Server running at http://127.0.0.1:4321/");
    expect(results).toHaveLength(1);
    expect(results[0]!.url).toBe("http://127.0.0.1:4321/");
  });

  it("reports correct startX and endX", () => {
    const prefix = "  ➜  Local:   ";
    const url = "http://localhost:5173/";
    const results = extractURLs(prefix + url);
    // startX is byte index, not char index; prefix uses multi-byte chars
    expect(results[0]!.url).toBe(url);
    expect(results[0]!.startX).toBeGreaterThanOrEqual(0);
    expect(results[0]!.endX).toBe(results[0]!.startX + url.length);
  });

  it("does not match non-localhost URLs", () => {
    expect(extractURLs("see https://example.com for docs")).toEqual([]);
  });

  it("detects multiple URLs on one line", () => {
    const line = "http://localhost:3000 and http://localhost:4000";
    expect(extractURLs(line)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test
```
Expected: FAIL — `extractURLs` not found.

- [ ] **Step 3: Implement terminal-url-links.ts**

Create `frontend/src/modules/terminal/lib/terminal-url-links.ts`:
```typescript
import type { ILink, ILinkProvider, Terminal } from "@xterm/xterm";

const URL_RE = /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):\d+(?:\/\S*)?/g;

export interface URLLinkMatch {
  url: string;
  startX: number;
  endX: number;
}

export function extractURLs(lineText: string): URLLinkMatch[] {
  const results: URLLinkMatch[] = [];
  for (const match of lineText.matchAll(new RegExp(URL_RE.source, "g"))) {
    const url = match[0];
    const startX = match.index!;
    results.push({ url, startX, endX: startX + url.length });
  }
  return results;
}

export function createURLLinkProvider(
  terminal: Terminal,
  onClick: (url: string, metaKey: boolean) => void,
): ILinkProvider {
  return {
    provideLinks(y: number, callback: (links: ILink[] | undefined) => void): void {
      const line = terminal.buffer.active.getLine(y - 1);
      if (!line) {
        callback(undefined);
        return;
      }
      const text = line.translateToString(true);
      const matches = extractURLs(text);
      if (matches.length === 0) {
        callback(undefined);
        return;
      }
      callback(
        matches.map((m): ILink => ({
          range: {
            start: { x: m.startX + 1, y },
            end: { x: m.endX, y },
          },
          text: m.url,
          activate(event: MouseEvent): void {
            onClick(m.url, event.metaKey || event.ctrlKey);
          },
        })),
      );
    },
  };
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test
```
Expected: all 7 URL link tests PASS alongside existing tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/terminal/lib/terminal-url-links.ts frontend/src/modules/terminal/lib/terminal-url-links.test.ts
git commit -m "feat(frontend): add terminal URL link provider"
```

---

## Task 10: Sidecar WS composable

**Files:**
- Create: `frontend/src/modules/terminal/lib/sidecar-ws.ts`

- [ ] **Step 1: Create sidecar-ws.ts**

```typescript
type ElementSelectedPayload = {
  type: "element-selected";
  selector: string;
  screenshotPath: string;
};

type ElementSelectedHandler = (payload: ElementSelectedPayload) => void;

let ws: WebSocket | null = null;
const handlers = new Set<ElementSelectedHandler>();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function connect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${proto}//${location.host}/sidecar/ws`);

  ws.addEventListener("message", (e) => {
    try {
      const msg = JSON.parse(e.data as string) as { type: string };
      if (msg.type === "element-selected") {
        for (const h of handlers) h(msg as ElementSelectedPayload);
      }
    } catch {
      // ignore
    }
  });

  ws.addEventListener("close", () => {
    reconnectTimer = setTimeout(connect, 2000);
  });
}

export function onElementSelected(handler: ElementSelectedHandler): () => void {
  if (handlers.size === 0) connect();
  handlers.add(handler);
  return () => handlers.delete(handler);
}
```

The composable connects lazily on first subscriber and reconnects on close. Returns a cleanup function so Terminal.vue can unsubscribe on unmount.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/modules/terminal/lib/sidecar-ws.ts
git commit -m "feat(frontend): add sidecar WebSocket composable"
```

---

## Task 11: Wire everything into Terminal.vue

**Files:**
- Modify: `frontend/src/modules/terminal/pages/Terminal.vue`

- [ ] **Step 1: Add imports**

In the `<script setup>` imports section, add:
```typescript
import { createURLLinkProvider } from "@/modules/terminal/lib/terminal-url-links";
import { onElementSelected } from "@/modules/terminal/lib/sidecar-ws";
```

- [ ] **Step 2: Register the URL link provider**

After the existing `terminal.registerLinkProvider(createFileLinkProvider(...))` call in `onMounted`, add:
```typescript
    terminal.registerLinkProvider(
      createURLLinkProvider(terminal, (url, metaKey) => {
        if (metaKey) {
          window.open(`/sidecar/proxy?target=${encodeURIComponent(url)}`, "_blank");
        } else {
          window.open(url, "_blank");
        }
      }),
    );
```

- [ ] **Step 3: Subscribe to element-selected events**

After the `sessions.attach` call in `onMounted`, add:
```typescript
    const unsubscribeSidecar = onElementSelected(({ selector, screenshotPath }) => {
      insertAtPrompt(`${selector}\nScreenshot: ${screenshotPath}\n`);
    });
```

In `onUnmounted`, add:
```typescript
  unsubscribeSidecar?.();
```

Declare `unsubscribeSidecar` outside `onMounted` so `onUnmounted` can close over it:
```typescript
let unsubscribeSidecar: (() => void) | undefined;
```

Then in `onMounted`: `unsubscribeSidecar = onElementSelected(...)`.

- [ ] **Step 4: Verify TypeScript**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/terminal/pages/Terminal.vue
git commit -m "feat(frontend): wire URL links and element-selected into terminal"
```

---

## Task 12: Build pipeline

**Files:**
- Modify: `package.json`
- Modify: `scripts/build-go.mjs`

- [ ] **Step 1: Prepend sidecar-client build to root build script**

In `package.json`, change:
```json
"build": "vite build --config frontend/vite.config.ts && node scripts/assert-shiki-bundle.mjs"
```
to:
```json
"build": "pnpm --filter @browser-sidecar/sidecar-client build && vite build --config frontend/vite.config.ts && node scripts/assert-shiki-bundle.mjs"
```

- [ ] **Step 2: Copy client.js to Go embed dir in build-go.mjs**

In `scripts/build-go.mjs`, after the block that copies the frontend build to `embedPublic`, add:

```javascript
// Copy sidecar-client bundle for go:embed
const sidecarDist = join(root, "sidecar-client/dist/client.js");
const sidecarEmbed = join(serverGo, "internal/sidecar/static/client.js");
if (!existsSync(sidecarDist)) {
  console.error("sidecar-client/dist/client.js missing. Run `pnpm run build` first.");
  process.exit(1);
}
console.log("Staging sidecar client for go:embed …");
mkdirSync(join(serverGo, "internal/sidecar/static"), { recursive: true });
cpSync(sidecarDist, sidecarEmbed);
```

Add this before the `go build` step.

- [ ] **Step 3: Full build smoke test**

```bash
pnpm run build:go --skip-ui=false
```
Expected: `bin/workbench-cli` produced, no errors.

- [ ] **Step 4: Run full test suite**

```bash
pnpm test && cd server-go && go test ./...
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/build-go.mjs server-go/internal/sidecar/static/client.js
git commit -m "chore: wire sidecar-client build into Go embed pipeline"
```

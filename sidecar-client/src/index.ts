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

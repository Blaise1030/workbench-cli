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

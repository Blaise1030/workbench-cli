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

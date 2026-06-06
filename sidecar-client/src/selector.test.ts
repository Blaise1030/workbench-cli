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

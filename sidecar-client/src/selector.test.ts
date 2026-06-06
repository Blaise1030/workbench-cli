import { describe, it, expect } from "vitest";
import { buildSelector, DYNAMIC_CLASS_RE } from "./selector";

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

  it("returns tag name for a detached bare element with no id, no classes, and no ancestors", () => {
    expect(buildSelector(el("span"))).toBe("span");
  });

  it("returns 'body' when passed document.body", () => {
    expect(buildSelector(document.body)).toBe("body");
  });

  it("stops at id and uses #id", () => {
    const e = el("div", { id: "main" });
    expect(buildSelector(e)).toBe("#main");
  });

  it("includes stable class names", () => {
    const e = el("button", { class: "btn primary" });
    expect(buildSelector(e)).toBe("button.btn.primary");
  });

  it("skips dynamic CSS-module-like class names (requires prefix, dash, then at least one digit in suffix)", () => {
    // regex: /^[a-z]+-(?=[a-z0-9]*\d)[a-z0-9]{4,}$/i — digit lookahead required
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

describe("DYNAMIC_CLASS_RE", () => {
  it("matches class names with prefix-dash-alphanumeric-suffix containing a digit", () => {
    expect(DYNAMIC_CLASS_RE.test("abc-1234")).toBe(true);
    expect(DYNAMIC_CLASS_RE.test("btn-a1b2")).toBe(true);
  });

  it("does not match suffix with no digit", () => {
    expect(DYNAMIC_CLASS_RE.test("card-header")).toBe(false);
    expect(DYNAMIC_CLASS_RE.test("abc-abcd")).toBe(false);
  });

  it("does not match suffix shorter than 4 characters", () => {
    expect(DYNAMIC_CLASS_RE.test("abc-12")).toBe(false);
  });
});

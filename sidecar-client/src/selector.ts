// browser-only
export const DYNAMIC_CLASS_RE = /^[a-z]+-(?=[a-z0-9]*\d)[a-z0-9]{4,}$/i;

const MAX_CLASSES = 2;

export function buildSelector(el: Element): string {
  if (el === document.body) return "body";

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
      .slice(0, MAX_CLASSES);

    const segment =
      stableClasses.length > 0 ? `${tag}.${stableClasses.join(".")}` : tag;
    parts.unshift(segment);
    current = current.parentElement;
  }

  return parts.join(" > ") || el.tagName.toLowerCase();
}

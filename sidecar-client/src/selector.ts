const DYNAMIC_CLASS_RE = /^[a-z]+-(?=[a-z0-9]*\d)[a-z0-9]{4,}$/i;

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

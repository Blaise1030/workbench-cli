const FAVICON_ID = "workbench-favicon";
let _dark = false;
let _badge = false;
const _cache = new Map<string, string>();

function faviconHref(dark: boolean): string {
  return dark ? "/favicon-dark.svg" : "/favicon-light.svg";
}

function ensureFaviconLink(): HTMLLinkElement {
  const existing = document.getElementById(FAVICON_ID) as HTMLLinkElement | null;
  if (existing) return existing;
  const link = document.createElement("link");
  link.id = FAVICON_ID;
  link.rel = "icon";
  link.type = "image/svg+xml";
  document.head.appendChild(link);
  return link;
}

async function fetchSvgText(href: string): Promise<string> {
  if (_cache.has(href)) return _cache.get(href)!;
  const text = await fetch(href).then((r) => r.text());
  _cache.set(href, text);
  return text;
}

async function applyFavicon(): Promise<void> {
  const link = ensureFaviconLink();
  const href = faviconHref(_dark);

  if (!_badge) {
    if (link.getAttribute("href") !== href) link.setAttribute("href", href);
    return;
  }

  const svgText = await fetchSvgText(href);
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const orig = doc.documentElement;
  const viewBox = orig.getAttribute("viewBox") ?? "0 0 32 32";
  const inner = orig.innerHTML;

  const composite = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><svg x="0" y="0" width="28" height="28" viewBox="${viewBox}">${inner}</svg><circle cx="30" cy="6" r="7" fill="#ef4444"/></svg>`;
  const dataUrl = `data:image/svg+xml,${encodeURIComponent(composite)}`;
  if (link.getAttribute("href") !== dataUrl) link.setAttribute("href", dataUrl);
}

/** Keep the tab favicon in sync with app light/dark mode. */
export function syncFavicon(dark: boolean): void {
  _dark = dark;
  void applyFavicon();
}

/** Show or hide the attention badge dot on the favicon. */
export function setFaviconBadge(badge: boolean): void {
  _badge = badge;
  void applyFavicon();
}

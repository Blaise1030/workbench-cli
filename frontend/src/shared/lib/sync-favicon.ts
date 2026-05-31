const FAVICON_ID = "workbench-favicon";

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

/** Keep the tab favicon in sync with app light/dark mode. */
export function syncFavicon(dark: boolean): void {
  const link = ensureFaviconLink();
  const href = faviconHref(dark);
  if (link.getAttribute("href") !== href) {
    link.setAttribute("href", href);
  }
}

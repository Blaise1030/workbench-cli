const LANDING_URL = (import.meta.env.VITE_LANDING_URL as string | undefined)?.replace(/\/$/, '') ?? 'https://workbench.nocodemonkeys1.workers.dev';

export const WHATS_NEW_URL = `${LANDING_URL}/whats-new.json`;

export const CHANGELOG_URL =
  "https://github.com/Blaise1030/workbench-cli/releases";

export type WhatsNewShortcutHint = {
  before: string;
  keys: string[];
  after: string;
};

export type WhatsNewSection = {
  heading?: string;
  paragraphs: string[];
  shortcut?: WhatsNewShortcutHint;
  link?: { label: string; href: string };
};

export type WhatsNewEntry = {
  id: string;
  title: string;
  summary: string;
  publishedAt: string;
  version?: string;
  heroIcon?: "bot" | "folder";
  image?: string;
  sections: WhatsNewSection[];
};

const ENTRIES_CACHE_KEY = "workbench:whats-new-entries";
const DISMISSED_KEY = "workbench:whats-new-dismissed";

export function readCachedWhatsNewEntries(): WhatsNewEntry[] {
  try {
    const raw = localStorage.getItem(ENTRIES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as WhatsNewEntry[]) : [];
  } catch {
    return [];
  }
}

export function writeCachedWhatsNewEntries(entries: WhatsNewEntry[]): void {
  localStorage.setItem(ENTRIES_CACHE_KEY, JSON.stringify(entries));
}

export function readDismissedWhatsNewIds(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

export function dismissWhatsNewId(id: string): void {
  const next = new Set(readDismissedWhatsNewIds());
  next.add(id);
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
}

export function latestUndismissedWhatsNew(
  entries: WhatsNewEntry[],
  dismissedIds: string[],
): WhatsNewEntry | null {
  for (const entry of entries) {
    if (!dismissedIds.includes(entry.id)) return entry;
  }
  return null;
}

export function formatReleaseDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

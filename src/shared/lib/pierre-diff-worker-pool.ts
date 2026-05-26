import type { SupportedLanguages, ThemesType } from "@pierre/diffs";
import {
  getOrCreateWorkerPoolSingleton,
  type WorkerPoolManager,
} from "@pierre/diffs/worker";
import WorkerUrl from "@pierre/diffs/worker/worker.js?worker&url";

/** Matches CodeView `theme` option in git + file preview. */
export const PIERRE_DIFF_THEME: ThemesType = {
  dark: "pierre-dark",
  light: "pierre-light",
};

/** Preload common repo languages; unknown extensions resolve at render time. */
const PRELOAD_LANGS: SupportedLanguages[] = [
  "typescript",
  "tsx",
  "javascript",
  "json",
  "markdown",
  "css",
  "html",
  "python",
  "go",
  "rust",
  "shell",
  "yaml",
  "toml",
];

let pool: WorkerPoolManager | null = null;
let initPromise: Promise<void> | null = null;

export function getPierreWorkerPool(): WorkerPoolManager {
  if (!pool) {
    pool = getOrCreateWorkerPoolSingleton({
      poolOptions: {
        workerFactory: () => new Worker(WorkerUrl, { type: "module" }),
        poolSize: 3,
      },
      highlighterOptions: {
        theme: PIERRE_DIFF_THEME,
        preferredHighlighter: "shiki-wasm",
        useTokenTransformer: true,
        langs: PRELOAD_LANGS,
      },
    });
    initPromise = pool.initialize(PRELOAD_LANGS).catch((error: unknown) => {
      initPromise = null;
      console.error("[pierre] worker pool failed to initialize", error);
      throw error;
    });
  }
  return pool;
}

export function whenPierreWorkerReady(): Promise<void> {
  getPierreWorkerPool();
  return initPromise ?? Promise.resolve();
}

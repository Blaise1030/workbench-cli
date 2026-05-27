import type { WorkerPoolManager } from "@pierre/diffs/worker";
import { getOrCreateWorkerPoolSingleton } from "@pierre/diffs/worker";
import WorkerUrl from "@pierre/diffs/worker/worker.js?worker&url";
import {
  PIERRE_DIFF_RENDER_OPTIONS,
  PIERRE_DIFF_THEME,
} from "@/shared/lib/pierre-config";
import { PIERRE_SHIKI_LANGS } from "@/shared/lib/pierre-shiki-langs";

export { PIERRE_DIFF_RENDER_OPTIONS, PIERRE_DIFF_THEME };

let pool: WorkerPoolManager | null = null;
let initPromise: Promise<void> | null = null;

/** Pierre diff worker pool with allowlisted Shiki grammars (see pierre-shiki-langs.ts). */
export function getPierreWorkerPool(): WorkerPoolManager {
  if (!pool) {
    pool = getOrCreateWorkerPoolSingleton({
      poolOptions: {
        workerFactory: () => new Worker(WorkerUrl, { type: "module" }),
        poolSize: 3,
      },
      highlighterOptions: {
        theme: PIERRE_DIFF_THEME,
        preferredHighlighter: "shiki-js",
        langs: PIERRE_SHIKI_LANGS,
        ...PIERRE_DIFF_RENDER_OPTIONS,
      },
    });
    initPromise = pool.initialize(PIERRE_SHIKI_LANGS).catch((error: unknown) => {
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

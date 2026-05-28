import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireSession } from "../auth/middleware.js";
import { isLocalRequest } from "../auth/local.js";
import type { Session } from "../auth/session.js";
import type { AppDatabase } from "../../db/index.js";
import {
  createWorktreeBodySchema,
  createTerminalBodySchema,
  gitCommitBodySchema,
  gitFileActionsBodySchema,
  registerProjectBodySchema,
  updateTerminalBodySchema,
  writeFileBodySchema,
} from "../../schemas/workspace.js";
import {
  deleteProject,
  listProjects,
  ProjectError,
  registerProject,
} from "./projects.js";
import {
  createWorktreeForProject,
  deleteWorktree,
  listWorktreesByProject,
  WorktreeError,
  getWorktree,
} from "./worktrees.js";
import { getDefaultBranch, listBranches } from "../git/worktree-list.js";
import { getProject } from "./projects.js";
import {
  createTerminal,
  deleteTerminal,
  listTerminals,
  TerminalError,
  updateTerminal,
} from "./terminals.js";
import { pickFolder } from "./pick-folder.js";
import {
  applyGitFileActionsForWorktree,
  commitGitForWorktree,
  getGitDiffForWorktree,
  getGitStatusForWorktree,
  GitPanelError,
} from "./git.js";
import { FileReadError, listFilesForWorktree, readFileForWorktree, writeFileForWorktree, searchFilesForWorktree } from "./files.js";
import {
  DropAssetError,
  saveWorkbenchDropAssets,
} from "./drop-assets.js";
import type { GitDiffScope } from "../git/diff.js";
import type { PtyRegistry } from "../terminal/pty-registry.js";

function handleWorkspaceError(err: unknown) {
  if (
    err instanceof ProjectError ||
    err instanceof WorktreeError ||
    err instanceof TerminalError ||
    err instanceof GitPanelError
  ) {
    return { message: err.message, status: err.status as 400 | 404 };
  }
  throw err;
}

function parseDiffScope(value: string | undefined): GitDiffScope {
  if (
    value === "staged" ||
    value === "unstaged" ||
    value === "untracked"
  ) {
    return value;
  }
  return "all";
}

export function createWorkspaceRouter(
  session: Session,
  { db }: AppDatabase,
  ptyRegistry?: PtyRegistry,
) {
  return new Hono()
    .use("*", requireSession(session))
    .get("/projects", async (c) => {
      const rows = await listProjects(db);
      return c.json({ projects: rows });
    })
    .post("/projects/pick-folder", async (c) => {
      if (!isLocalRequest(c)) {
        return c.json({ error: "Folder picker is only available on localhost" }, 403);
      }
      const repoPath = pickFolder();
      if (!repoPath) {
        return c.json({ cancelled: true as const });
      }
      try {
        const project = await registerProject(db, repoPath);
        return c.json({ project }, 201);
      } catch (err) {
        const e = handleWorkspaceError(err);
        if (e) return c.json({ error: e.message }, e.status);
        throw err;
      }
    })
    .post("/projects", zValidator("json", registerProjectBodySchema), async (c) => {
      try {
        const { repoPath } = c.req.valid("json");
        const project = await registerProject(db, repoPath);
        return c.json({ project }, 201);
      } catch (err) {
        const e = handleWorkspaceError(err);
        if (e) return c.json({ error: e.message }, e.status);
        throw err;
      }
    })
    .delete("/projects/:id", async (c) => {
      try {
        await deleteProject(db, c.req.param("id"));
        return c.json({ ok: true as const });
      } catch (err) {
        const e = handleWorkspaceError(err);
        if (e) return c.json({ error: e.message }, e.status);
        throw err;
      }
    })
    .get("/projects/:id/branches", async (c) => {
      try {
        const project = await getProject(db, c.req.param("id"));
        if (!project) return c.json({ error: "Project not found" }, 404);
        const branches = listBranches(project.repoPath);
        const defaultBranch = getDefaultBranch(project.repoPath);
        return c.json({ branches, defaultBranch });
      } catch (err) {
        const e = handleWorkspaceError(err);
        if (e) return c.json({ error: e.message }, e.status);
        throw err;
      }
    })
    .get("/projects/:id/worktrees", async (c) => {
      try {
        const worktreeList = await listWorktreesByProject(db, c.req.param("id"));
        return c.json({ worktrees: worktreeList });
      } catch (err) {
        const e = handleWorkspaceError(err);
        if (e) return c.json({ error: e.message }, e.status);
        throw err;
      }
    })
    .post(
      "/projects/:id/worktrees",
      zValidator("json", createWorktreeBodySchema),
      async (c) => {
        try {
          const body = c.req.valid("json");
          const worktree = await createWorktreeForProject(db, c.req.param("id"), body);
          return c.json({ worktree }, 201);
        } catch (err) {
          const e = handleWorkspaceError(err);
          if (e) return c.json({ error: e.message }, e.status);
          throw err;
        }
      },
    )
    .get("/worktrees/:id", async (c) => {
      const worktree = await getWorktree(db, c.req.param("id"));
      if (!worktree) return c.json({ error: "Worktree not found" }, 404);
      return c.json({ worktree });
    })
    .get("/worktrees/:id/files", async (c) => {
      const worktree = await getWorktree(db, c.req.param("id"));
      if (!worktree) return c.json({ error: "Worktree not found" }, 404);
      const paths = await listFilesForWorktree(worktree.path);
      return c.json({ paths });
    })
    .get("/worktrees/:id/files/search", async (c) => {
      const worktree = await getWorktree(db, c.req.param("id"));
      if (!worktree) return c.json({ error: "Worktree not found" }, 404);
      const q = c.req.query("q") ?? "";
      const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10), 100);
      if (!q.trim()) return c.json({ paths: [] });
      const paths = await searchFilesForWorktree(worktree.path, q, limit);
      return c.json({ paths });
    })
    .get("/worktrees/:id/files/content", async (c) => {
      const worktree = await getWorktree(db, c.req.param("id"));
      if (!worktree) return c.json({ error: "Worktree not found" }, 404);
      const path = c.req.query("path");
      if (!path) return c.json({ error: "path query parameter is required" }, 400);
      try {
        const file = await readFileForWorktree(worktree.path, path);
        return c.json(file);
      } catch (err) {
        if (err instanceof FileReadError) {
          return c.json({ error: err.message }, err.status);
        }
        throw err;
      }
    })
    .put(
      "/worktrees/:id/files/content",
      zValidator("json", writeFileBodySchema),
      async (c) => {
        const worktree = await getWorktree(db, c.req.param("id"));
        if (!worktree) return c.json({ error: "Worktree not found" }, 404);
        const { path, content } = c.req.valid("json");
        try {
          await writeFileForWorktree(worktree.path, path, content);
          return c.json({ ok: true as const });
        } catch (err) {
          if (err instanceof FileReadError) {
            return c.json({ error: err.message }, err.status);
          }
          throw err;
        }
      },
    )
    .post("/worktrees/:id/drop-assets", async (c) => {
      const worktree = await getWorktree(db, c.req.param("id"));
      if (!worktree) return c.json({ error: "Worktree not found" }, 404);
      try {
        const body = await c.req.parseBody({ all: true });
        const raw = body.files;
        const fileList = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(
          (f): f is File => f instanceof File,
        );
        if (!fileList.length) {
          return c.json({ error: "No files provided" }, 400);
        }
        const paths = await saveWorkbenchDropAssets(fileList);
        return c.json({ paths });
      } catch (err) {
        if (err instanceof DropAssetError) {
          return c.json({ error: err.message }, err.status);
        }
        throw err;
      }
    })
    .get("/worktrees/:id/git/status", async (c) => {
      try {
        const status = await getGitStatusForWorktree(db, c.req.param("id"));
        return c.json(status);
      } catch (err) {
        const e = handleWorkspaceError(err);
        if (e) return c.json({ error: e.message }, e.status);
        throw err;
      }
    })
    .get("/worktrees/:id/git/diff", async (c) => {
      try {
        const scope = parseDiffScope(c.req.query("scope"));
        const path = c.req.query("path");
        const diff = await getGitDiffForWorktree(
          db,
          c.req.param("id"),
          scope,
          path || undefined,
        );
        return c.json(diff);
      } catch (err) {
        const e = handleWorkspaceError(err);
        if (e) return c.json({ error: e.message }, e.status);
        throw err;
      }
    })
    .post(
      "/worktrees/:id/git/actions",
      zValidator("json", gitFileActionsBodySchema),
      async (c) => {
        try {
          const { action, paths } = c.req.valid("json");
          const result = await applyGitFileActionsForWorktree(
            db,
            c.req.param("id"),
            action,
            paths,
          );
          return c.json(result);
        } catch (err) {
          const e = handleWorkspaceError(err);
          if (e) return c.json({ error: e.message }, e.status);
          throw err;
        }
      },
    )
    .post(
      "/worktrees/:id/git/commit",
      zValidator("json", gitCommitBodySchema),
      async (c) => {
        try {
          const { message } = c.req.valid("json");
          const result = await commitGitForWorktree(
            db,
            c.req.param("id"),
            message,
          );
          return c.json(result);
        } catch (err) {
          const e = handleWorkspaceError(err);
          if (e) return c.json({ error: e.message }, e.status);
          throw err;
        }
      },
    )
    .delete("/worktrees/:id", async (c) => {
      try {
        await deleteWorktree(db, c.req.param("id"));
        return c.json({ ok: true as const });
      } catch (err) {
        const e = handleWorkspaceError(err);
        if (e) return c.json({ error: e.message }, e.status);
        throw err;
      }
    })
    .get("/worktrees/:id/terminals", async (c) => {
      try {
        const rows = await listTerminals(db, c.req.param("id"));
        return c.json({ terminals: rows });
      } catch (err) {
        const e = handleWorkspaceError(err);
        if (e) return c.json({ error: e.message }, e.status);
        throw err;
      }
    })
    .post("/worktrees/:id/terminals", async (c) => {
        try {
          let title: string | undefined;
          try {
            const body = await c.req.json();
            const parsed = createTerminalBodySchema.safeParse(body);
            if (parsed.success) title = parsed.data.title;
          } catch {
            // empty body
          }
          const terminal = await createTerminal(db, c.req.param("id"), title);
          return c.json({ terminal }, 201);
        } catch (err) {
          const e = handleWorkspaceError(err);
          if (e) return c.json({ error: e.message }, e.status);
          throw err;
        }
      })
    .patch(
      "/terminals/:id",
      zValidator("json", updateTerminalBodySchema),
      async (c) => {
        try {
          const patch = c.req.valid("json");
          const terminal = await updateTerminal(db, c.req.param("id"), patch);
          return c.json({ terminal });
        } catch (err) {
          const e = handleWorkspaceError(err);
          if (e) return c.json({ error: e.message }, e.status);
          throw err;
        }
      },
    )
    .delete("/terminals/:id", async (c) => {
      try {
        await deleteTerminal(db, c.req.param("id"), (id) => ptyRegistry?.kill(id));
        return c.json({ ok: true as const });
      } catch (err) {
        const e = handleWorkspaceError(err);
        if (e) return c.json({ error: e.message }, e.status);
        throw err;
      }
    });
}

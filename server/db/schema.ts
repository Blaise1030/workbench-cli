import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  repoPath: text("repo_path").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const worktrees = sqliteTable("worktrees", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  branch: text("branch"),
  baseBranch: text("base_branch"),
  gitDir: text("git_dir"),
  isLinked: integer("is_linked", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const terminals = sqliteTable("terminals", {
  id: text("id").primaryKey(),
  worktreeId: text("worktree_id")
    .notNull()
    .references(() => worktrees.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  resumeCommand: text("resume_command"),
  resumeTrusted: integer("resume_trusted", { mode: "boolean" }).notNull().default(false),
  agentKind: text("agent_kind"),
  agentSessionId: text("agent_session_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export type Project = typeof projects.$inferSelect;
export type Worktree = typeof worktrees.$inferSelect;
export type Terminal = typeof terminals.$inferSelect;
export type Setting = typeof settings.$inferSelect;

import { z } from "zod";

export const registerProjectBodySchema = z.object({
  repoPath: z.string().min(1),
});

export const createWorktreeBodySchema = z.object({
  branch: z.string().min(1),
  baseBranch: z.string().min(1).optional(),
  path: z.string().min(1).optional(),
  isNewBranch: z.boolean().optional(),
});

export const createTerminalBodySchema = z.object({
  title: z.string().optional(),
});

export const updateTerminalBodySchema = z.object({
  title: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  resumeCommand: z.string().nullable().optional(),
  resumeTrusted: z.boolean().optional(),
});

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  repoPath: z.string(),
  createdAt: z.coerce.date(),
});

export const worktreeSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  path: z.string(),
  branch: z.string().nullable(),
  baseBranch: z.string().nullable(),
  gitDir: z.string().nullable(),
  isLinked: z.boolean(),
  createdAt: z.coerce.date(),
});

export const terminalSchema = z.object({
  id: z.string(),
  worktreeId: z.string(),
  title: z.string(),
  sortOrder: z.number(),
  resumeCommand: z.string().nullable(),
  resumeTrusted: z.boolean(),
  agentKind: z.string().nullable(),
  agentSessionId: z.string().nullable(),
  createdAt: z.coerce.date(),
});

export const branchesResponseSchema = z.object({
  branches: z.array(z.string()),
  defaultBranch: z.string(),
});

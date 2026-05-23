import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/vue-query";
import { computed, type MaybeRefOrGetter, toValue } from "vue";
import { apiClient } from "@/lib/api-client";
import { ensureOk } from "@/lib/api-error";

export interface Project {
  id: string;
  name: string;
  repoPath: string;
  createdAt: string;
}

export interface Worktree {
  id: string;
  projectId: string;
  path: string;
  branch: string | null;
  baseBranch: string | null;
  gitDir: string | null;
  isLinked: boolean;
  createdAt: string;
}

export interface TerminalTab {
  id: string;
  worktreeId: string;
  title: string;
  sortOrder: number;
  createdAt: string;
}

export type GitFileStatusCode =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "untracked"
  | "unmerged"
  | "ignored"
  | "unknown";

export interface GitStatusEntry {
  path: string;
  previousPath?: string;
  staged: GitFileStatusCode | null;
  unstaged: GitFileStatusCode | null;
}

export type GitDiffScope = "all" | "staged" | "unstaged";

export const workspaceKeys = {
  all: ["workspace"] as const,
  projects: () => [...workspaceKeys.all, "projects"] as const,
  branches: (projectId: string) =>
    [...workspaceKeys.all, "branches", projectId] as const,
  worktrees: (projectId: string) =>
    [...workspaceKeys.all, "worktrees", projectId] as const,
  worktree: (worktreeId: string) =>
    [...workspaceKeys.all, "worktree", worktreeId] as const,
  terminals: (worktreeId: string) =>
    [...workspaceKeys.all, "terminals", worktreeId] as const,
  gitStatus: (worktreeId: string) =>
    [...workspaceKeys.all, "git-status", worktreeId] as const,
  gitDiff: (worktreeId: string, scope: GitDiffScope, path: string | null) =>
    [...workspaceKeys.all, "git-diff", worktreeId, scope, path] as const,
};

export function projectsQueryOptions() {
  return queryOptions({
    queryKey: workspaceKeys.projects(),
    queryFn: async () => {
      const res = await apiClient.projects.$get();
      const data = await ensureOk<{ projects: Project[] }>(res);
      return data.projects;
    },
  });
}

export function useProjectsQuery() {
  return useQuery(projectsQueryOptions());
}

export function branchesQueryOptions(projectId: MaybeRefOrGetter<string>) {
  return queryOptions({
    queryKey: computed(() => workspaceKeys.branches(toValue(projectId))),
    queryFn: async () => {
      const id = toValue(projectId);
      const res = await apiClient.projects[":id"].branches.$get({
        param: { id },
      });
      return ensureOk<{ branches: string[]; defaultBranch: string }>(res);
    },
    enabled: computed(() => Boolean(toValue(projectId))),
  });
}

export function worktreesQueryOptions(projectId: MaybeRefOrGetter<string>) {
  return queryOptions({
    queryKey: computed(() => workspaceKeys.worktrees(toValue(projectId))),
    queryFn: async () => {
      const id = toValue(projectId);
      const res = await apiClient.projects[":id"].worktrees.$get({
        param: { id },
      });
      const data = await ensureOk<{ worktrees: Worktree[] }>(res);
      return data.worktrees;
    },
    enabled: computed(() => Boolean(toValue(projectId))),
  });
}

export function worktreeQueryOptions(worktreeId: MaybeRefOrGetter<string>) {
  return queryOptions({
    queryKey: computed(() => workspaceKeys.worktree(toValue(worktreeId))),
    queryFn: async () => {
      const id = toValue(worktreeId);
      const res = await apiClient.worktrees[":id"].$get({ param: { id } });
      const data = await ensureOk<{ worktree: Worktree }>(res);
      return data.worktree;
    },
    enabled: computed(() => Boolean(toValue(worktreeId))),
  });
}

export function terminalsQueryOptions(worktreeId: MaybeRefOrGetter<string>) {
  return queryOptions({
    queryKey: computed(() => workspaceKeys.terminals(toValue(worktreeId))),
    queryFn: async () => {
      const id = toValue(worktreeId);
      const res = await apiClient.worktrees[":id"].terminals.$get({
        param: { id },
      });
      const data = await ensureOk<{ terminals: TerminalTab[] }>(res);
      return data.terminals;
    },
    enabled: computed(() => Boolean(toValue(worktreeId))),
  });
}

export function useTerminalsQuery(worktreeId: MaybeRefOrGetter<string>) {
  return useQuery(terminalsQueryOptions(worktreeId));
}

export function gitStatusQueryOptions(worktreeId: MaybeRefOrGetter<string>) {
  return queryOptions({
    queryKey: computed(() => workspaceKeys.gitStatus(toValue(worktreeId))),
    queryFn: async () => {
      const id = toValue(worktreeId);
      const res = await apiClient.worktrees[":id"].git.status.$get({
        param: { id },
      });
      return ensureOk<{ branch: string | null; files: GitStatusEntry[] }>(res);
    },
    enabled: computed(() => Boolean(toValue(worktreeId))),
    refetchInterval: 5_000,
  });
}

export function gitDiffQueryOptions(
  worktreeId: MaybeRefOrGetter<string>,
  scope: MaybeRefOrGetter<GitDiffScope>,
  path: MaybeRefOrGetter<string | null>,
) {
  return queryOptions({
    queryKey: computed(() =>
      workspaceKeys.gitDiff(
        toValue(worktreeId),
        toValue(scope),
        toValue(path),
      ),
    ),
    queryFn: async () => {
      const id = toValue(worktreeId);
      const res = await apiClient.worktrees[":id"].git.diff.$get({
        param: { id },
        query: {
          scope: toValue(scope),
          ...(toValue(path) ? { path: toValue(path)! } : {}),
        },
      });
      return ensureOk<{ patch: string; scope: GitDiffScope; path: string | null }>(
        res,
      );
    },
    enabled: computed(() => Boolean(toValue(worktreeId))),
  });
}

export function useRegisterProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (repoPath: string) => {
      const res = await apiClient.projects.$post({ json: { repoPath } });
      const data = await ensureOk<{ project: Project }>(res);
      return data.project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.projects() });
    },
  });
}

export function usePickProjectFolderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.projects["pick-folder"].$post();
      const data = await ensureOk<{ cancelled?: true; project?: Project }>(res);
      if (data.cancelled) {
        return { cancelled: true as const };
      }
      if (!data.project) {
        throw new Error("Unexpected response from folder picker");
      }
      return { cancelled: false as const, project: data.project };
    },
    onSuccess: (result) => {
      if (!result.cancelled) {
        queryClient.invalidateQueries({ queryKey: workspaceKeys.projects() });
      }
    },
  });
}

export function useCreateWorktreeMutation(projectId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      branch: string;
      baseBranch?: string;
      path?: string;
      isNewBranch?: boolean;
    }) => {
      const res = await apiClient.projects[":id"].worktrees.$post({
        param: { id: toValue(projectId) },
        json: body,
      });
      const data = await ensureOk<{ worktree: Worktree }>(res);
      return data.worktree;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.worktrees(toValue(projectId)),
      });
    },
  });
}

export function useCreateTerminalMutation(worktreeId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (title?: string) => {
      const res = await apiClient.worktrees[":id"].terminals.$post({
        param: { id: toValue(worktreeId) },
        json: title ? { title } : {},
      });
      const data = await ensureOk<{ terminal: TerminalTab }>(res);
      return data.terminal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.terminals(toValue(worktreeId)),
      });
    },
  });
}

export function useDeleteTerminalMutation(worktreeId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (terminalId: string) => {
      const res = await apiClient.terminals[":id"].$delete({
        param: { id: terminalId },
      });
      await ensureOk<{ ok: true }>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.terminals(toValue(worktreeId)),
      });
    },
  });
}

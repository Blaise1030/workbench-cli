import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/vue-query";
import { computed, type MaybeRefOrGetter, toValue } from "vue";
import { apiClient } from "@/lib/api-client";
import { ensureOk } from "@/lib/api-error";
import { workspaceKeys } from "./keys";
import type { Project, Worktree } from "./types";

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

export function useDeleteWorktreeMutation(projectId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (worktreeId: string) => {
      const res = await apiClient.worktrees[":id"].$delete({
        param: { id: worktreeId },
      });
      await ensureOk<{ ok: true }>(res);
    },
    onSuccess: (_, worktreeId) => {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.worktrees(toValue(projectId)),
      });
      queryClient.removeQueries({
        queryKey: workspaceKeys.worktree(worktreeId),
      });
      queryClient.removeQueries({
        queryKey: workspaceKeys.terminals(worktreeId),
      });
    },
  });
}

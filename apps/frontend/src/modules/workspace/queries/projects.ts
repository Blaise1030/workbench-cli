import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/vue-query";
import { computed, type MaybeRefOrGetter, toValue } from "vue";
import { toast } from "vue-sonner";
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

/**
 * Single request returning every project's worktrees, keyed by project id.
 * Powers the whole sidebar — one fetch instead of one-per-project.
 */
export function allWorktreesQueryOptions() {
  return queryOptions({
    queryKey: workspaceKeys.worktrees(),
    queryFn: async () => {
      const res = await apiClient.worktrees.$get();
      const data = await ensureOk<{
        worktreesByProject: Record<string, Worktree[]>;
      }>(res);
      return data.worktreesByProject;
    },
    // No polling: app-initiated changes invalidate via mutations, and external
    // `git worktree add`/`remove` arrives over SSE (the "worktrees" topic, fired
    // by the FS watcher on .git/worktrees changes). refetchOnWindowFocus still
    // self-heals if an event is ever missed while the tab was backgrounded.
    refetchOnWindowFocus: "always",
    gcTime: 60_000,
  });
}

/**
 * Per-project worktrees, derived from {@link allWorktreesQueryOptions} via
 * `select`. Shares the aggregate query key, so every consumer is served by the
 * same single network request.
 */
export function worktreesQueryOptions(projectId: MaybeRefOrGetter<string>) {
  return queryOptions({
    ...allWorktreesQueryOptions(),
    select: (data: Record<string, Worktree[]>) =>
      data[toValue(projectId)] ?? [],
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
      toast.success("Project registered");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to register project");
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
        toast.success("Project added");
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to open folder");
    },
  });
}

export function useCheckoutBranchMutation(projectId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (branch: string) => {
      const res = await fetch(`/api/projects/${toValue(projectId)}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ branch }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).error ?? "Checkout failed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.worktrees() });
      toast.success("Branch checked out");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
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
        queryKey: workspaceKeys.worktrees(),
      });
      toast.success("Worktree created");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to create worktree");
    },
  });
}

export function useDeleteProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string) => {
      const res = await apiClient.projects[":id"].$delete({
        param: { id: projectId },
      });
      await ensureOk<{ ok: true }>(res);
    },
    onSuccess: (_, projectId) => {
      const worktrees =
        queryClient.getQueryData<Record<string, Worktree[]>>(
          workspaceKeys.worktrees(),
        )?.[projectId] ?? [];
      queryClient.invalidateQueries({ queryKey: workspaceKeys.projects() });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.worktrees() });
      queryClient.removeQueries({ queryKey: workspaceKeys.branches(projectId) });
      for (const w of worktrees) {
        queryClient.removeQueries({ queryKey: workspaceKeys.worktree(w.id) });
        queryClient.removeQueries({ queryKey: workspaceKeys.terminals(w.id) });
      }
      toast.success("Project removed");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to remove project");
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
      const pid = toValue(projectId);
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.worktrees(),
      });
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.branches(pid),
      });
      queryClient.removeQueries({
        queryKey: workspaceKeys.worktree(worktreeId),
      });
      queryClient.removeQueries({
        queryKey: workspaceKeys.terminals(worktreeId),
      });
      toast.success("Worktree deleted");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete worktree");
    },
  });
}

import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { type MaybeRefOrGetter, toValue } from "vue";
import { toast } from "vue-sonner";
import { ensureOk } from "@/lib/api-error";
import { invalidateWorkspaceFs } from "@/modules/workspace/queries/invalidate-workspace-fs";

export function useCreateFile(worktreeId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ path, type }: { path: string; type: "file" | "directory" }) => {
      const id = toValue(worktreeId);
      const res = await fetch(`/api/worktrees/${id}/files`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, type }),
      });
      await ensureOk<{ ok: boolean }>(res);
    },
    onSuccess: (_data, { type }) => {
      invalidateWorkspaceFs(queryClient, toValue(worktreeId));
      toast.success(type === "directory" ? "Directory created" : "File created");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to create entry");
    },
  });
}

export function useDeleteFile(worktreeId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ path }: { path: string }) => {
      const id = toValue(worktreeId);
      const res = await fetch(`/api/worktrees/${id}/files`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      await ensureOk<{ ok: boolean }>(res);
    },
    onSuccess: () => {
      invalidateWorkspaceFs(queryClient, toValue(worktreeId));
      toast.success("Entry deleted");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete entry");
    },
  });
}

export function useMoveFile(worktreeId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ from, to }: { from: string; to: string }) => {
      const id = toValue(worktreeId);
      const res = await fetch(`/api/worktrees/${id}/files/move`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      await ensureOk<{ ok: boolean }>(res);
    },
    onSuccess: () => {
      invalidateWorkspaceFs(queryClient, toValue(worktreeId));
      toast.success("Entry moved");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to move entry");
    },
  });
}

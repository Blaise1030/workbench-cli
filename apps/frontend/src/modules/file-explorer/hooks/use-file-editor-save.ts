import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { type MaybeRefOrGetter, toValue } from "vue";
import { toast } from "vue-sonner";
import { apiClient } from "@/lib/api-client";
import { ensureOk } from "@/lib/api-error";
import { workspaceKeys } from "@/modules/workspace/queries/keys";

export function useFileEditorSave(worktreeId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();

  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: async ({ path, content }: { path: string; content: string }) => {
      const id = toValue(worktreeId);
      const res = await apiClient.worktrees[":id"].files.content.$put({
        param: { id },
        json: { path, content },
      });
      await ensureOk<{ ok: true }>(res);
    },
    onSuccess: (_data, { path }) => {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.fileContent(toValue(worktreeId), path),
      });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to save file");
    },
  });

  async function save(path: string, content: string): Promise<boolean> {
    try {
      await mutateAsync({ path, content });
      return true;
    } catch {
      return false;
    }
  }

  return { save, isSaving: isPending, saveError: error };
}

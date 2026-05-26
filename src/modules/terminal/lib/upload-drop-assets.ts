import { ensureOk } from "@/lib/api-error";

export async function uploadWorkbenchDropAssets(
  worktreeId: string,
  files: File[],
): Promise<string[]> {
  if (!files.length) return [];

  const form = new FormData();
  for (const file of files) {
    form.append("files", file);
  }

  const res = await fetch(`/api/worktrees/${encodeURIComponent(worktreeId)}/drop-assets`, {
    method: "POST",
    body: form,
    credentials: "include",
  });

  const data = await ensureOk<{ paths: string[] }>(res);
  return data.paths;
}

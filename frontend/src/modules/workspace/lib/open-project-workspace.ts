import type { QueryClient } from "@tanstack/vue-query";
import type { Router } from "vue-router";
import { worktreesQueryOptions } from "@/modules/workspace/queries";
import { worktreePath } from "@/modules/workspace/lib/worktree-env";
import type { Project } from "@/modules/workspace/queries/types";

export async function openProjectWorkspace(
  queryClient: QueryClient,
  router: Router,
  project: Project,
) {
  const worktrees = await queryClient.ensureQueryData(
    worktreesQueryOptions(project.id),
  );
  const main =
    worktrees.find((w) => w.path === project.repoPath) ?? worktrees[0];
  if (!main) throw new Error("No worktree found for project");

  localStorage.setItem("lastWorktreeId", main.id);
  await router.push(worktreePath(main.id));
}

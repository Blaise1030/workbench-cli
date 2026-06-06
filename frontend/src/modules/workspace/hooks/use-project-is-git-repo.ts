import { useQuery } from "@tanstack/vue-query";
import { computed, type MaybeRefOrGetter, toValue } from "vue";
import { projectsQueryOptions } from "@/modules/workspace/queries";

export function useProjectIsGitRepo(projectId: MaybeRefOrGetter<string | undefined>) {
  const { data: projects } = useQuery(projectsQueryOptions());

  return computed(() => {
    const id = toValue(projectId);
    if (!id) return false;
    return projects.value?.find((project) => project.id === id)?.isGitRepo ?? false;
  });
}

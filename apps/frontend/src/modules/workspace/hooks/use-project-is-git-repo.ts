import { useQuery } from "@tanstack/vue-query";
import { computed, type MaybeRefOrGetter, toValue } from "vue";
import { projectsQueryOptions } from "@/modules/workspace/queries";

/** `undefined` while project metadata is still loading. */
export function useProjectIsGitRepo(projectId: MaybeRefOrGetter<string | undefined>) {
  const { data: projects } = useQuery(projectsQueryOptions());

  return computed((): boolean | undefined => {
    const id = toValue(projectId);
    if (!id) return undefined;
    if (projects.value === undefined) return undefined;
    const project = projects.value.find((entry) => entry.id === id);
    if (!project) return undefined;
    return project.isGitRepo;
  });
}

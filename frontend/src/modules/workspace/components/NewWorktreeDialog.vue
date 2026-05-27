<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { PlusIcon } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SidebarMenuSubButton } from "@/components/ui/sidebar";
import BranchCombobox from "@/modules/workspace/components/BranchCombobox.vue";
import {
  branchesQueryOptions,
  useCreateWorktreeMutation,
} from "@/modules/workspace/queries";
import { useQuery } from "@tanstack/vue-query";

const props = defineProps<{
  projectId: string;
}>();

const open = ref(false);
const baseBranch = ref("");
const branch = ref("");
const error = ref("");

const router = useRouter();
const createWorktree = useCreateWorktreeMutation(() => props.projectId);
const { data: branchData } = useQuery({
  ...branchesQueryOptions(() => props.projectId),
  enabled: computed(() => open.value && Boolean(props.projectId)),
});

watch(
  () => branchData.value,
  (data) => {
    if (!data || baseBranch.value) return;
    baseBranch.value = data.defaultBranch;
  },
  { immediate: true },
);

watch(open, (isOpen) => {
  if (!isOpen) {
    error.value = "";
    branch.value = "";
    return;
  }
  if (branchData.value && !baseBranch.value) {
    baseBranch.value = branchData.value.defaultBranch;
  }
});

const branches = computed(() => branchData.value?.branches ?? []);

async function submit() {
  error.value = "";
  const branchName = branch.value.trim();
  if (!branchName) {
    error.value = "Enter a branch name";
    return;
  }
  if (!baseBranch.value) {
    error.value = "Choose a branch to create from";
    return;
  }

  try {
    const worktree = await createWorktree.mutateAsync({
      branch: branchName,
      baseBranch: baseBranch.value,
      isNewBranch: true,
    });
    open.value = false;
    localStorage.setItem("lastWorktreeId", worktree.id);
    await router.push({
      name: "workspace",
      params: { worktreeId: worktree.id },
    });
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to create worktree";
  }
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <SidebarMenuSubButton
        as="button"
        type="button"
        size="sm"
        class="text-muted-foreground"
      >
        <PlusIcon class="stroke-muted-foreground" />
        <span>New worktree</span>
      </SidebarMenuSubButton>
    </PopoverTrigger>
    <PopoverContent class="w-72" align="start" side="right">
      <form class="grid gap-4" @submit.prevent="submit">
        <p class="text-sm font-medium">New worktree</p>

        <div class="grid gap-2">
          <Label>Create from branch</Label>
          <BranchCombobox
            v-model="baseBranch"
            :branches="branches"
            placeholder="Select base branch"
          />
        </div>

        <div class="grid gap-2">
          <Label>New branch name</Label>
          <Input
            v-model="branch"
            data-native-keyboard
            placeholder="feat-my-change"
            autocomplete="off"
          />
        </div>

        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

        <div class="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            @click="open = false"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            :disabled="createWorktree.isPending.value"
          >
            Create
          </Button>
        </div>
      </form>
    </PopoverContent>
  </Popover>
</template>

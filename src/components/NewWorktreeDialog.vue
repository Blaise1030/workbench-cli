<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  branchesQueryOptions,
  useCreateWorktreeMutation,
} from "@/api/workspace";
import { useQuery } from "@tanstack/vue-query";

const props = defineProps<{
  projectId: string;
}>();

const open = defineModel<boolean>("open", { default: false });

const mode = ref<"existing" | "new">("new");
const baseBranch = ref("");
const branch = ref("");
const path = ref("");
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
    path.value = "";
    mode.value = "new";
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
  if (mode.value === "new" && !baseBranch.value) {
    error.value = "Choose a branch to create from";
    return;
  }

  try {
    const worktree = await createWorktree.mutateAsync({
      branch: branchName,
      baseBranch: mode.value === "new" ? baseBranch.value : undefined,
      path: path.value.trim() || undefined,
      isNewBranch: mode.value === "new",
    });
    open.value = false;
    localStorage.setItem("lastWorktreeId", worktree.id);
    await router.push({ name: "workspace", params: { worktreeId: worktree.id } });
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to create worktree";
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>New worktree</DialogTitle>
      </DialogHeader>
      <form class="grid gap-4" @submit.prevent="submit">
        <div class="flex gap-2">
          <Button
            type="button"
            size="sm"
            :variant="mode === 'new' ? 'default' : 'outline'"
            @click="mode = 'new'"
          >
            New branch
          </Button>
          <Button
            type="button"
            size="sm"
            :variant="mode === 'existing' ? 'default' : 'outline'"
            @click="mode = 'existing'"
          >
            Existing branch
          </Button>
        </div>

        <div v-if="mode === 'new'" class="grid gap-2">
          <Label>Create from branch</Label>
          <Select v-model="baseBranch">
            <SelectTrigger>
              <SelectValue placeholder="Select base branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="b in branches" :key="b" :value="b">
                {{ b }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="grid gap-2">
          <Label>{{ mode === "new" ? "New branch name" : "Branch" }}</Label>
          <Select v-if="mode === 'existing'" v-model="branch">
            <SelectTrigger>
              <SelectValue placeholder="Select branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="b in branches" :key="b" :value="b">
                {{ b }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Input v-else v-model="branch" placeholder="feat-my-change" autocomplete="off" />
        </div>

        <div class="grid gap-2">
          <Label for="worktree-path">Path (optional)</Label>
          <Input
            id="worktree-path"
            v-model="path"
            placeholder="Auto-generated next to repo"
            autocomplete="off"
          />
        </div>

        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">
            Cancel
          </Button>
          <Button type="submit" :disabled="createWorktree.isPending.value">
            Create worktree
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

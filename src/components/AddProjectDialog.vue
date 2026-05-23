<script setup lang="ts">
import { ref } from "vue";
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
import { useRegisterProjectMutation } from "@/api/workspace";

const open = defineModel<boolean>("open", { default: false });

const repoPath = ref("");
const error = ref("");
const register = useRegisterProjectMutation();

async function submit() {
  error.value = "";
  const path = repoPath.value.trim();
  if (!path) {
    error.value = "Enter a repository path";
    return;
  }
  try {
    await register.mutateAsync(path);
    repoPath.value = "";
    open.value = false;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to register project";
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Add project</DialogTitle>
      </DialogHeader>
      <form class="grid gap-4" @submit.prevent="submit">
        <div class="grid gap-2">
          <Label for="repo-path">Repository path</Label>
          <Input
            id="repo-path"
            v-model="repoPath"
            placeholder="/Users/you/Developer/my-app"
            autocomplete="off"
          />
          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">
            Cancel
          </Button>
          <Button type="submit" :disabled="register.isPending.value">
            Add project
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

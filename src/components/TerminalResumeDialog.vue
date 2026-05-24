<script setup lang="ts">
import { ref, watch } from "vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useUpdateTerminalMutation } from "@/api/workspace";
import { ApiError } from "@/lib/api-error";

const props = defineProps<{
  open: boolean;
  terminalId: string;
  worktreeId: string;
  initialCommand?: string | null;
  initialTrusted?: boolean;
}>();

const emit = defineEmits<{ "update:open": [value: boolean] }>();

const command = ref("");
const trusted = ref(false);
const error = ref("");

const updateTerminal = useUpdateTerminalMutation(() => props.worktreeId);

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    command.value = props.initialCommand ?? "";
    trusted.value = props.initialTrusted ?? false;
    error.value = "";
  },
);

function close() {
  emit("update:open", false);
}

async function save() {
  error.value = "";
  const trimmed = command.value.trim();
  try {
    await updateTerminal.mutateAsync({
      terminalId: props.terminalId,
      patch: {
        resumeCommand: trimmed || null,
        resumeTrusted: trimmed ? trusted.value : false,
      },
    });
    close();
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : "Failed to save restart command.";
  }
}

async function clearCommand() {
  error.value = "";
  try {
    await updateTerminal.mutateAsync({
      terminalId: props.terminalId,
      patch: { resumeCommand: null, resumeTrusted: false },
    });
    close();
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : "Failed to clear restart command.";
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Restart command</DialogTitle>
        <DialogDescription>
          When this terminal starts cold (after server restart or idle timeout), run this shell
          command instead of a plain login shell. Only enable trust if you understand the risk.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-4 py-2">
        <div class="space-y-2">
          <Label for="resume-command">Command</Label>
          <Input
            id="resume-command"
            v-model="command"
            placeholder="tmux attach -t work"
            :disabled="updateTerminal.isPending.value"
          />
        </div>

        <div class="flex items-start gap-2">
          <Checkbox
            id="resume-trusted"
            :checked="trusted"
            :disabled="!command.trim() || updateTerminal.isPending.value"
            @update:checked="(v) => (trusted = v === true)"
          />
          <Label for="resume-trusted" class="text-sm font-normal leading-snug">
            Trust this command — run automatically on cold start without prompting again.
          </Label>
        </div>

        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
      </div>

      <DialogFooter class="gap-2 sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          :disabled="updateTerminal.isPending.value || !initialCommand"
          @click="clearCommand"
        >
          Clear
        </Button>
        <div class="flex gap-2">
          <Button type="button" variant="outline" @click="close">Cancel</Button>
          <Button type="button" :disabled="updateTerminal.isPending.value" @click="save">
            Save
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from "vue";
import { KEYBINDING_DESCRIPTORS } from "@/modules/keyboard/types";
import { DEFAULT_KEYBINDINGS } from "@/modules/keyboard/defaults";
import {
  useKeybindingsQuery,
  useUpdateKeybindingsMutation,
} from "@/modules/keyboard/queries/keybindings";
import type { KeybindingAction, KeybindingsMap } from "@/modules/keyboard/types";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import SettingsPage from "@/modules/settings/components/SettingsPage.vue";
import SettingsSection from "@/modules/settings/components/SettingsSection.vue";
import SettingsRow from "@/modules/settings/components/SettingsRow.vue";

const { data: serverBindings } = useKeybindingsQuery();
const updateMutation = useUpdateKeybindingsMutation();

const draft = reactive<KeybindingsMap>({ ...DEFAULT_KEYBINDINGS });

watch(
  serverBindings,
  (val) => {
    if (val) Object.assign(draft, val);
  },
  { immediate: true },
);

const capturingAction = ref<KeybindingAction | null>(null);
const captureDisplay = ref<string>("");
const hasConflict = ref<KeybindingAction | null>(null);

function chordLabel(chord: string): string {
  return chord
    .replace("Meta", "⌘")
    .replace("Ctrl", "⌃")
    .replace("Alt", "⌥")
    .replace("Shift", "⇧")
    .replace(/\+/g, "");
}

function startCapture(action: KeybindingAction) {
  capturingAction.value = action;
  captureDisplay.value = "Press keys…";
  hasConflict.value = null;
}

function eventToChord(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.metaKey) parts.push("Meta");
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  const key = e.key;
  if (!["Meta", "Control", "Alt", "Shift"].includes(key)) {
    parts.push(key.length === 1 ? key.toLowerCase() : key);
  }
  return parts.join("+");
}

function onCaptureKeydown(e: KeyboardEvent) {
  if (!capturingAction.value) return;
  e.preventDefault();
  e.stopPropagation();

  if (e.key === "Escape") {
    capturingAction.value = null;
    return;
  }

  const chord = eventToChord(e);
  if (!chord.includes("+")) return;

  captureDisplay.value = chordLabel(chord);

  const conflict = (Object.keys(draft) as KeybindingAction[]).find(
    (a) => a !== capturingAction.value && draft[a] === chord,
  );
  hasConflict.value = conflict ?? null;

  draft[capturingAction.value] = chord;
  capturingAction.value = null;
}

async function save() {
  try {
    await updateMutation.mutateAsync({ ...draft });
    toast.success("Keybindings saved");
  } catch {
    toast.error("Failed to save keybindings");
  }
}

function resetToDefaults() {
  Object.assign(draft, DEFAULT_KEYBINDINGS);
}
</script>

<template>
  <div tabindex="-1" @keydown="onCaptureKeydown">
  <SettingsPage
    title="Keybindings"
    description="Remap workspace shortcuts. Changes are saved to your local workbench config."
  >
    <template #actions>
      <Button variant="outline" size="sm" @click="resetToDefaults">
        Reset to defaults
      </Button>
      <Button size="sm" :disabled="updateMutation.isPending.value" @click="save">
        {{ updateMutation.isPending.value ? "Saving…" : "Save" }}
      </Button>
    </template>

    <div v-if="hasConflict" class="border-b border-amber-500/30 bg-amber-500/10 px-8 py-3 text-sm text-amber-600 dark:text-amber-400">
      Conflict: this chord is also assigned to "{{
        KEYBINDING_DESCRIPTORS.find((d) => d.action === hasConflict)?.label
      }}". Both will be saved — last key pressed wins.
    </div>

    <SettingsSection title="Workspace shortcuts">
      <SettingsRow
        v-for="desc in KEYBINDING_DESCRIPTORS"
        :key="desc.action"
        :label="desc.label"
        :description="desc.description"
      >
        <button
          type="button"
          class="inline-flex min-w-[4rem] items-center justify-center rounded-md border border-input bg-muted/50 px-3 py-1.5 text-xs font-mono hover:bg-muted"
          :class="
            capturingAction === desc.action
              ? 'border-foreground ring-1 ring-foreground animate-pulse'
              : ''
          "
          @click="startCapture(desc.action)"
        >
          {{
            capturingAction === desc.action
              ? captureDisplay
              : chordLabel(draft[desc.action])
          }}
        </button>
      </SettingsRow>
    </SettingsSection>
  </SettingsPage>
  </div>
</template>

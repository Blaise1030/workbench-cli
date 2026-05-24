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
  <div @keydown="onCaptureKeydown" tabindex="-1">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-sm font-medium">Keyboard Shortcuts</h2>
      <div class="flex gap-2">
        <button
          class="px-3 py-1 text-xs rounded border text-muted-foreground hover:text-foreground"
          @click="resetToDefaults"
        >
          Reset to defaults
        </button>
        <button
          class="px-3 py-1 text-xs rounded bg-foreground text-background hover:opacity-90"
          :disabled="updateMutation.isPending.value"
          @click="save"
        >
          {{ updateMutation.isPending.value ? "Saving…" : "Save" }}
        </button>
      </div>
    </div>

    <div v-if="hasConflict" class="mb-3 text-xs text-amber-500">
      Conflict: this chord is also assigned to "{{
        KEYBINDING_DESCRIPTORS.find((d) => d.action === hasConflict)?.label
      }}". Both will be saved — last key pressed wins.
    </div>

    <table class="w-full text-sm">
      <thead>
        <tr class="border-b text-xs text-muted-foreground">
          <th class="pb-2 text-left font-normal">Action</th>
          <th class="pb-2 text-left font-normal">Description</th>
          <th class="pb-2 text-left font-normal">Shortcut</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="desc in KEYBINDING_DESCRIPTORS"
          :key="desc.action"
          class="border-b last:border-0"
        >
          <td class="py-2 pr-4 font-medium">{{ desc.label }}</td>
          <td class="py-2 pr-4 text-muted-foreground text-xs">{{ desc.description }}</td>
          <td class="py-2">
            <button
              class="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-mono"
              :class="
                capturingAction === desc.action
                  ? 'border-foreground bg-muted animate-pulse'
                  : 'hover:border-foreground/50'
              "
              @click="startCapture(desc.action)"
            >
              {{
                capturingAction === desc.action
                  ? captureDisplay
                  : chordLabel(draft[desc.action])
              }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

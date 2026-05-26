<script setup lang="ts">
import { ref, reactive, watch, computed } from "vue";
import { KEYBINDING_DESCRIPTORS } from "@/modules/keyboard/types";
import { KEYBINDING_OPTIONS } from "@/modules/keyboard/options";
import {
  chordLabel,
  eventToChord,
  isBrowserReservedChord,
  normalizeStoredChord,
} from "@/modules/keyboard/chord";
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

const draft = reactive<KeybindingsMap>({ ...KEYBINDING_OPTIONS });

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
const browserReservedChord = ref<string | null>(null);

const browserReservedInDraft = computed(() =>
  (Object.keys(draft) as KeybindingAction[]).filter((action) =>
    isBrowserReservedChord(normalizeStoredChord(draft[action])),
  ),
);

function startCapture(action: KeybindingAction) {
  capturingAction.value = action;
  captureDisplay.value = "Press keys…";
  hasConflict.value = null;
  browserReservedChord.value = null;
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
  browserReservedChord.value = isBrowserReservedChord(chord) ? chord : null;

  const conflict = (Object.keys(draft) as KeybindingAction[]).find(
    (a) =>
      a !== capturingAction.value && normalizeStoredChord(draft[a]) === chord,
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

function resetToOptions() {
  Object.assign(draft, KEYBINDING_OPTIONS);
  browserReservedChord.value = null;
}
</script>

<template>
  <div tabindex="-1" @keydown.capture="onCaptureKeydown">
  <SettingsPage
    title="Keybindings"
    description="Remap workspace shortcuts. Built-in options use ⌃⇧ for panels, settings, and new terminal; ⌥+symbol for tabs."
  >
    <template #actions>
      <Button variant="outline" size="sm" @click="resetToOptions">
        Reset to options
      </Button>
      <Button size="sm" :disabled="updateMutation.isPending.value" @click="save">
        {{ updateMutation.isPending.value ? "Saving…" : "Save" }}
      </Button>
    </template>

    <div
      v-if="browserReservedChord || browserReservedInDraft.length"
      class="border-b border-amber-500/30 bg-amber-500/10 px-8 py-3 text-sm text-amber-600 dark:text-amber-400"
    >
      <template v-if="browserReservedChord">
        {{ chordLabel(browserReservedChord) }} is usually handled by the browser before this app
        can use it. Prefer ⌃⇧ (Ctrl+Shift) or another chord.
      </template>
      <template v-else>
        Some shortcuts may not work in the browser:
        {{
          browserReservedInDraft
            .map((a) => KEYBINDING_DESCRIPTORS.find((d) => d.action === a)?.label)
            .filter(Boolean)
            .join(", ")
        }}.
        Reset to options or remap with Ctrl+Shift.
      </template>
    </div>

    <div
      v-if="hasConflict"
      class="border-b border-amber-500/30 bg-amber-500/10 px-8 py-3 text-sm text-amber-600 dark:text-amber-400"
    >
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
        <div class="flex flex-col items-end gap-1">
          <button
            type="button"
            class="inline-flex min-w-[4rem] items-center justify-center rounded-md border border-input bg-muted/50 px-3 py-1.5 text-xs font-mono hover:bg-muted"
            :class="[
              capturingAction === desc.action
                ? 'border-foreground ring-1 ring-foreground animate-pulse'
                : '',
              isBrowserReservedChord(normalizeStoredChord(draft[desc.action]))
                ? 'border-amber-500/50 text-amber-600 dark:text-amber-400'
                : '',
            ]"
            @click="startCapture(desc.action)"
          >
            {{
              capturingAction === desc.action
                ? captureDisplay
                : chordLabel(draft[desc.action])
            }}
          </button>
          <span
            v-if="isBrowserReservedChord(normalizeStoredChord(draft[desc.action]))"
            class="text-[10px] text-amber-600 dark:text-amber-400"
          >
            Browser may intercept
          </span>
        </div>
      </SettingsRow>
    </SettingsSection>
  </SettingsPage>
  </div>
</template>

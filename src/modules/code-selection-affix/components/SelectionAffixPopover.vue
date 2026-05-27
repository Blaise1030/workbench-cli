<script setup lang="ts">
import { ListPlusIcon } from "@lucide/vue";
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import {
  clampPopupRect,
  type Rect,
} from "@/modules/code-selection-affix/lib/context-queue-anchor";

const props = withDefaults(
  defineProps<{
    visible: boolean;
    anchor: Rect | null;
    label?: string;
  }>(),
  {
    label: "Add to queue",
  },
);

const emit = defineEmits<{
  append: [];
}>();

const popupEl = ref<HTMLElement | null>(null);
const position = ref({ left: 0, top: 0 });

const fallbackSize = { w: 140, h: 32 };

function updatePosition(): void {
  if (!props.visible || !props.anchor) return;
  const el = popupEl.value;
  const w = el?.offsetWidth || fallbackSize.w;
  const h = el?.offsetHeight || fallbackSize.h;
  position.value = clampPopupRect(props.anchor, w, h);
}

/** Two rAF passes so layout uses measured popup size after `v-if` mounts. */
function scheduleReposition(): void {
  requestAnimationFrame(() => {
    updatePosition();
    requestAnimationFrame(() => updatePosition());
  });
}

const showPopup = computed(() => props.visible && props.anchor != null);

let popupResizeObserver: ResizeObserver | null = null;

function unbindGlobalLayout(): void {
  window.removeEventListener("resize", scheduleReposition);
  window.visualViewport?.removeEventListener("resize", scheduleReposition);
  window.visualViewport?.removeEventListener("scroll", scheduleReposition);
}

function bindGlobalLayout(): void {
  unbindGlobalLayout();
  window.addEventListener("resize", scheduleReposition);
  window.visualViewport?.addEventListener("resize", scheduleReposition);
  window.visualViewport?.addEventListener("scroll", scheduleReposition);
}

watch(
  () => [props.visible, props.anchor] as const,
  async () => {
    await nextTick();
    if (showPopup.value && popupEl.value) {
      popupResizeObserver?.disconnect();
      popupResizeObserver = new ResizeObserver(() => scheduleReposition());
      popupResizeObserver.observe(popupEl.value);
      bindGlobalLayout();
    } else if (!showPopup.value) {
      popupResizeObserver?.disconnect();
      popupResizeObserver = null;
      unbindGlobalLayout();
    }
    scheduleReposition();
  },
  { immediate: true, deep: true },
);

onUnmounted(() => {
  popupResizeObserver?.disconnect();
  unbindGlobalLayout();
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="showPopup"
      ref="popupEl"
      class="code-selection-affix pointer-events-auto flex items-center rounded-md border border-border bg-popover p-0.5 shadow-md"
      :style="{
        position: 'fixed',
        left: `${position.left}px`,
        top: `${position.top}px`,
        right: 'auto',
        bottom: 'auto',
        zIndex: 9999,
      }"
      @pointerdown.stop
    >
      <Button
        type="button"
        variant="secondary"
        size="xs"
        class="text-xs shadow-none"
        @click="emit('append')"
      >
        <ListPlusIcon class="size-3.5" />
        {{ label }}
      </Button>
    </div>
  </Teleport>
</template>

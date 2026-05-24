<script setup lang="ts">
import type { SplitterResizeHandleEmits, SplitterResizeHandleProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { SplitterResizeHandle, useForwardPropsEmits } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<SplitterResizeHandleProps & { class?: HTMLAttributes['class'], withHandle?: boolean }>()
const emits = defineEmits<SplitterResizeHandleEmits>()

const delegatedProps = reactiveOmit(props, 'class', 'withHandle')
const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <SplitterResizeHandle
    data-slot="resizable-handle"
    v-bind="forwarded"
    :class="cn('group relative flex w-px shrink-0 items-center justify-center overflow-visible bg-border ring-offset-background after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden active:bg-muted active:[&_[data-slot=resize-grip]]:bg-muted data-[resize-handle-state=drag]:bg-muted data-[resize-handle-state=drag]:[&_[data-slot=resize-grip]]:bg-muted data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:translate-x-0 data-[panel-group-direction=vertical]:after:-translate-y-1/2 [&[data-panel-group-direction=vertical]_[data-slot=resize-grip]]:rotate-90', props.class)"
  >
    <template v-if="props.withHandle">
      <div
        data-slot="resize-grip"
        class="absolute top-1/2 left-1/2 z-10 h-6 w-1 shrink-0 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-border"
      >
        <slot />
      </div>
    </template>
  </SplitterResizeHandle>
</template>

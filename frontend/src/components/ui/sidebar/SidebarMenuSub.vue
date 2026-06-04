<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <ul
    data-slot="sidebar-menu-sub"
    data-sidebar="menu-sub"
    :class="cn(
      'border-sidebar-border mx-3.5 translate-x-px gap-0.5 border-l pl-2.5 pr-1 py-0 group-data-[collapsible=icon]:hidden flex min-w-0 flex-col',
      props.class,
    )"
  >
    <slot />
  </ul>
</template>

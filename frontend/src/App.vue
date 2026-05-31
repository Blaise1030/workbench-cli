<template>
  <RouterView />
  <AppCommandPalette />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import AppCommandPalette from '@/modules/command-palette/AppCommandPalette.vue'
import { useWorkbenchDocumentTitle } from '@/modules/workspace/hooks/use-workbench-document-title'
import { useAppColorMode } from '@/shared/hooks/useAppColorMode'

useWorkbenchDocumentTitle()
useAppColorMode()

function handleBeforeUnload(e: BeforeUnloadEvent) {
  e.preventDefault()
  e.returnValue = ''
}

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
})
</script>

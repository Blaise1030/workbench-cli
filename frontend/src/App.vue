<template>
  <RouterView />
  <AppCommandPalette />
  <Toaster />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import AppCommandPalette from '@/modules/command-palette/AppCommandPalette.vue'
import { Toaster } from '@/components/ui/sonner'
import { useWorkbenchDocumentTitle } from '@/modules/workspace/hooks/use-workbench-document-title'
import { useAppColorMode } from '@/shared/hooks/useAppColorMode'
import { useServerEvents } from '@/lib/server-events'

useWorkbenchDocumentTitle()
useAppColorMode()
useServerEvents()

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

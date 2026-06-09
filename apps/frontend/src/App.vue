<template>
  <RouterView />
  <AppCommandPalette />
  <Toaster expand />  
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import AppCommandPalette from '@/modules/command-palette/AppCommandPalette.vue'
import { Toaster } from '@/components/ui/sonner'
import 'vue-sonner/style.css'
import { useWorkbenchDocumentTitle } from '@/modules/workspace/hooks/use-workbench-document-title'
import { useAppColorMode } from '@/shared/hooks/useAppColorMode'
import { useServerEvents } from '@/lib/server-events'
import { useWhatsNew } from '@/modules/workspace/hooks/use-whats-new'
import { useFaviconBadge } from '@/shared/hooks/useFaviconBadge'

useWorkbenchDocumentTitle()
useAppColorMode()
useServerEvents()
useWhatsNew()
useFaviconBadge()

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

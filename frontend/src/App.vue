<template>
  <RouterView />
  <AppCommandPalette />
  <NotificationPanel />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import AppCommandPalette from '@/modules/command-palette/AppCommandPalette.vue'
import NotificationPanel from '@/modules/notifications/components/NotificationPanel.vue'
import { provideNotificationsStore } from '@/modules/notifications/hooks/use-notifications'
import { useNotificationDesktopAlerts } from '@/modules/notifications/hooks/use-notification-desktop-alerts'
import { ensureNotificationPermission } from '@/modules/notifications/lib/desktop-notify'
import { useWorkbenchDocumentTitle } from '@/modules/workspace/hooks/use-workbench-document-title'
import { useAppColorMode } from '@/shared/hooks/useAppColorMode'

useWorkbenchDocumentTitle()
useAppColorMode()
const notificationsStore = provideNotificationsStore()
useNotificationDesktopAlerts(notificationsStore)

onMounted(() => {
  ensureNotificationPermission()
})

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

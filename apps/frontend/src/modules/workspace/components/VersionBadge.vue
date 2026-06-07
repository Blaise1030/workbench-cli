<script setup lang="ts">
import { ref } from "vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useVersionCheck } from "@/modules/settings/hooks/use-version-check";
import UpdateAvailableDialog from "@/modules/workspace/components/UpdateAvailableDialog.vue";

const dialogOpen = ref(false);

const {
  currentVersion,
  latestVersion,
  updateAvailable,
  isLoading,
  dismissUpdate,
} = useVersionCheck();

function openDialog() {
  dialogOpen.value = true;
}
</script>

<template>
  <div v-if="!isLoading && currentVersion" class="flex items-center gap-1">
    <Badge variant="outline" class="font-normal text-muted-foreground">
      v{{ currentVersion }}
    </Badge>
    <Button
      v-if="updateAvailable"
      type="button"
      variant="default"
      size="xs"
      @click="openDialog"
    >
      Update
    </Button>
    <UpdateAvailableDialog
      v-model:open="dialogOpen"
      :current-version="currentVersion"
      :latest-version="latestVersion"
      @dismiss="dismissUpdate"
    />
  </div>
</template>

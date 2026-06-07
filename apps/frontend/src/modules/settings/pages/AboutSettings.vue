<script setup lang="ts">
import { ExternalLinkIcon, RefreshCwIcon } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import SettingsPage from "@/modules/settings/components/SettingsPage.vue";
import SettingsSection from "@/modules/settings/components/SettingsSection.vue";
import { useVersionCheck } from "@/modules/settings/hooks/use-version-check";
import { RELEASES_URL, INSTALL_CMD } from "@/modules/settings/lib/release";
import { useQuery } from "@tanstack/vue-query";
import { healthQueryOptions } from "@/modules/settings/queries/version";

const { currentVersion, latestVersion, hasNewerRelease, isLoading } = useVersionCheck();
const health = useQuery(healthQueryOptions());

function refetchVersion() {
  void health.refetch();
}
</script>

<template>
  <SettingsPage title="About" description="Version info and update status.">
    <SettingsSection title="Version">
      <Card class="flex flex-col gap-2 p-4">
        <Item variant="outline">
          <ItemContent>
            <ItemTitle>Current version</ItemTitle>
          </ItemContent>
          <ItemActions>
            <span class="font-mono text-sm text-muted-foreground">{{ currentVersion || "—" }}</span>
          </ItemActions>
        </Item>

        <Item variant="outline">
          <ItemContent>
            <ItemTitle>Latest version</ItemTitle>
          </ItemContent>
          <ItemActions>
            <div class="flex items-center gap-2">
              <span class="font-mono text-sm text-muted-foreground">{{ latestVersion || "—" }}</span>
              <Badge v-if="hasNewerRelease" variant="default" class="text-xs">Update available</Badge>
              <Badge v-else-if="currentVersion && latestVersion" variant="secondary" class="text-xs">Up to date</Badge>
            </div>
          </ItemActions>
        </Item>

        <Item v-if="hasNewerRelease" variant="outline">
          <ItemContent>
            <ItemTitle>Update</ItemTitle>
            <ItemDescription>Run this in your terminal to update.</ItemDescription>
          </ItemContent>
          <ItemActions>
            <code class="rounded bg-muted px-2 py-1 font-mono text-xs">{{ INSTALL_CMD }}</code>
          </ItemActions>
        </Item>
      </Card>
    </SettingsSection>

    <SettingsSection title="Resources">
      <Card class="flex flex-col gap-2 p-4">
        <Item variant="outline">
          <ItemContent>
            <ItemTitle>Release notes</ItemTitle>
            <ItemDescription>See what changed in each version.</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button variant="outline" size="sm" as-child>
              <a :href="RELEASES_URL" target="_blank" rel="noopener noreferrer" class="flex items-center gap-1.5">
                View releases
                <ExternalLinkIcon class="size-3.5" />
              </a>
            </Button>
          </ItemActions>
        </Item>

        <Item variant="outline">
          <ItemContent>
            <ItemTitle>Check for updates</ItemTitle>
            <ItemDescription>Re-fetch the latest version info.</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button variant="outline" size="sm" :disabled="isLoading" @click="refetchVersion">
              <RefreshCwIcon class="size-3.5 mr-1.5" :class="{ 'animate-spin': isLoading }" />
              Check now
            </Button>
          </ItemActions>
        </Item>
      </Card>
    </SettingsSection>
  </SettingsPage>
</template>

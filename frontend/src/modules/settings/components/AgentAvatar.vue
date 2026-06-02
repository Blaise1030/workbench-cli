<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { computed } from "vue";
import { BotIcon } from "@lucide/vue";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AgentBuiltinIcon from "@/modules/settings/components/AgentBuiltinIcon.vue";
import { cn } from "@/lib/utils";

const INLINE_BUILTIN_IDS = new Set(["claude", "codex", "cursor", "gemini"]);

const props = withDefaults(
  defineProps<{
    agentId: string;
    name: string;
    icon?: string;
    size?: "sm" | "default";
    class?: HTMLAttributes["class"];
  }>(),
  { size: "sm" },
);

const useInlineBuiltin = computed(
  () => !props.icon?.trim() && INLINE_BUILTIN_IDS.has(props.agentId),
);

const src = computed(() => props.icon?.trim() || undefined);

const initials = computed(() => {
  const parts = props.name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return props.name.trim().slice(0, 2).toUpperCase() || "?";
});

const avatarClass = computed(() =>
  cn(
    "shrink-0 rounded-lg",
    props.size === "sm" ? "size-8" : "size-10",
    props.class,
  ),
);

const builtinIconClass = computed(() =>
  props.size === "sm" ? "size-8" : "size-10",
);
</script>

<template>
  <div
    v-if="useInlineBuiltin"
    :class="cn('flex shrink-0 items-center justify-center', avatarClass)"
  >
    <AgentBuiltinIcon :agent-id="agentId" :extra-class="builtinIconClass" />
  </div>
  <Avatar v-else :class="avatarClass">
    <AvatarImage v-if="src" :src="src" :alt="name" class="rounded-lg object-cover" />
    <AvatarFallback class="rounded-lg bg-muted text-xs font-medium text-muted-foreground">
      <BotIcon v-if="!name.trim()" class="size-4" />
      <span v-else>{{ initials }}</span>
    </AvatarFallback>
  </Avatar>
</template>

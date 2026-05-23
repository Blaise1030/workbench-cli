<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import Login from "@/components/Login.vue";

const route = useRoute();
const router = useRouter();
const inviteLoading = ref(false);
const inviteError = ref("");

onMounted(async () => {
  const invite = route.query.invite;
  if (typeof invite !== "string" || !invite) return;

  inviteLoading.value = true;
  inviteError.value = "";
  try {
    const res = await fetch("/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token: invite }),
    });
    if (res.ok) {
      await router.replace({ name: "terminal" });
      return;
    }
    const body = await res.json().catch(() => ({}));
    inviteError.value =
      typeof body.error === "string" ? body.error : "Invalid invite link.";
  } catch {
    inviteError.value = "Could not reach server.";
  } finally {
    inviteLoading.value = false;
  }
});

function onAuthenticated() {
  router.push({ name: "terminal" });
}
</script>

<template>
  <div v-if="inviteLoading" class="flex min-h-screen items-center justify-center text-muted-foreground">
    Connecting…
  </div>
  <div v-else>
    <p v-if="inviteError" class="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
      {{ inviteError }}
    </p>
    <Login @authenticated="onAuthenticated" />
  </div>
</template>

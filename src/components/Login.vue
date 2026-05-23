<script setup lang="ts">
import { ref } from "vue";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const emit = defineEmits<{ authenticated: [] }>();

const token = ref("");
const error = ref("");
const loading = ref(false);

async function submit() {
  error.value = "";
  loading.value = true;
  try {
    const res = await fetch("/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token.value }),
    });
    if (res.ok) {
      emit("authenticated");
      return;
    }
    const body = await res.json().catch(() => ({}));
    if (res.status === 409) {
      error.value = "Another session is already active.";
    } else if (res.status === 401 && body.error?.includes("expired")) {
      error.value = "Token expired — restart the server.";
    } else {
      error.value = "Invalid token.";
    }
  } catch {
    error.value = "Could not reach server.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex items-center justify-center min-h-screen bg-background">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle>lan-terminal</CardTitle>
        <CardDescription>Enter the access token printed in your terminal.</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="flex flex-col gap-3" @submit.prevent="submit">
          <Input
            v-model="token"
            type="password"
            placeholder="Access token"
            autocomplete="off"
            autofocus
          />
          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
          <Button type="submit" :disabled="loading || !token">
            {{ loading ? "Connecting…" : "Connect" }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>

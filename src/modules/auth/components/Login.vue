<script setup lang="ts">
import { ref } from "vue";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuthMutation } from "@/api/auth";
import { ApiError } from "@/lib/api-error";

const emit = defineEmits<{ authenticated: [] }>();

const token = ref("");
const error = ref("");
const auth = useAuthMutation();

async function submit() {
  error.value = "";
  try {
    await auth.mutateAsync(token.value);
    emit("authenticated");
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 409) {
        error.value = "Another session is already active.";
      } else if (err.status === 401 && err.message.includes("expired")) {
        error.value = "Token expired — restart the server.";
      } else {
        error.value = err.message || "Invalid token.";
      }
    } else {
      error.value = "Could not reach server.";
    }
  }
}
</script>

<template>
  <div class="flex items-center justify-center min-h-screen bg-background">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Workbench CLI</CardTitle>
        <CardDescription>Enter the access token printed in your terminal.</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="flex flex-col gap-3" @submit.prevent="submit">
          <Input
            data-native-keyboard
            v-model="token"
            type="password"
            placeholder="Access token"
            autocomplete="off"
            autofocus
          />
          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
          <Button type="submit" :disabled="auth.isPending.value || !token">
            {{ auth.isPending.value ? "Connecting…" : "Connect" }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>

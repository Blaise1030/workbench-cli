import { ensureOk } from "@/lib/api-error";
import type { CreateNotificationInput, Notification } from "@/modules/notifications/types";

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T;
  if (!res.ok) {
    const err = data as { error?: string };
    throw new Error(err.error ?? `Request failed (${res.status})`);
  }
  return data;
}

export async function fetchNotifications(): Promise<Notification[]> {
  const res = await fetch("/api/notifications", { credentials: "include" });
  const data = await parseJson<{ notifications: Notification[] }>(res);
  return data.notifications;
}

export async function createNotification(input: CreateNotificationInput): Promise<Notification> {
  const res = await fetch("/api/notifications", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ notification: Notification }>(res);
  return data.notification;
}

export async function markNotificationRead(id: string): Promise<void> {
  const res = await fetch(`/api/notifications/${id}/read`, {
    method: "PATCH",
    credentials: "include",
  });
  await ensureOk(res);
}

export async function markAllNotificationsRead(): Promise<void> {
  const res = await fetch("/api/notifications/read-all", {
    method: "POST",
    credentials: "include",
  });
  await ensureOk(res);
}

export async function deleteNotification(id: string): Promise<void> {
  const res = await fetch(`/api/notifications/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  await ensureOk(res);
}

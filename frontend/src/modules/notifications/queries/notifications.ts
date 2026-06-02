import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/vue-query";
import {
  createNotification,
  deleteNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/modules/notifications/lib/notifications-api";
import type { CreateNotificationInput } from "@/modules/notifications/types";

export const notificationKeys = {
  all: ["notifications"] as const,
};

export function notificationsQueryOptions() {
  return queryOptions({
    queryKey: notificationKeys.all,
    queryFn: fetchNotifications,
    refetchInterval: 5_000,
  });
}

export function useNotificationsQuery() {
  return useQuery(notificationsQueryOptions());
}

export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllNotificationsReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useDeleteNotificationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useSendNotificationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateNotificationInput) => createNotification(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

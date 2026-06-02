export interface Notification {
  id: string;
  worktreeId: string | null;
  terminalId: string | null;
  title: string;
  subtitle: string | null;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface CreateNotificationInput {
  worktreeId?: string | null;
  terminalId?: string | null;
  title: string;
  subtitle?: string | null;
  body: string;
}

export type NotificationType = "TASK_ASSIGNED" | string;

export type WorkspaceNotification = {
  id: string;
  workspaceId: string | null;
  taskId: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string | null;
  /** Deep-link when the notification references a task. */
  href: string | null;
};

export type NotificationListResult = {
  items: WorkspaceNotification[];
  total: number;
  unreadCount: number;
};

export type NotificationListFilters = {
  unread?: boolean | null;
  page?: number;
  pageSize?: number;
};

export type NotificationPreference = {
  taskAssigned: boolean;
};

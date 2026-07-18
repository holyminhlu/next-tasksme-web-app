/**
 * Legacy shell notification helpers retained for tests that still import
 * unread filtering. Seeded/local notification content has been removed —
 * the shell loads workspace notifications from the backend API.
 */

export type ShellNotificationKind = "system" | "tip" | "task";

export type ShellNotification = {
  id: string;
  kind: ShellNotificationKind;
  title: string;
  body: string;
  /** Optional route the notification links to. */
  href?: string;
  readAt?: string | null;
  createdAt?: string | null;
};

/** @deprecated Seeded local notifications are no longer used. */
export function seededNotifications(
  workspaceName: string | null,
): ShellNotification[] {
  void workspaceName;
  return [];
}

export function unreadNotifications(
  notifications: ShellNotification[],
  readIds: string[] = [],
): ShellNotification[] {
  return notifications.filter((notification) => {
    if (notification.readAt) {
      return false;
    }

    return !readIds.includes(notification.id);
  });
}

/**
 * Local shell notifications.
 *
 * There is no backend notifications API yet, so the shell delivers a small
 * set of locally generated system notices per workspace. Read state persists
 * in shell preferences (localStorage). The UI labels these as local so users
 * are never misled about backend delivery.
 */

export type ShellNotificationKind = "system" | "tip";

export type ShellNotification = {
  id: string;
  kind: ShellNotificationKind;
  title: string;
  body: string;
  /** Optional route the notification links to. */
  href?: string;
};

export function seededNotifications(
  workspaceName: string | null,
): ShellNotification[] {
  return [
    {
      id: "system-welcome",
      kind: "system",
      title: workspaceName
        ? `Welcome to ${workspaceName}`
        : "Welcome to Task SME",
      body: "Your workspace shell is ready. Use the sidebar to move between areas, or press Ctrl/Cmd+K to jump anywhere.",
      href: "/dashboard",
    },
    {
      id: "tip-command-palette",
      kind: "tip",
      title: "Try the command palette",
      body: "Press Ctrl+K (Cmd+K on Mac) to search pages and run quick actions from anywhere.",
    },
    {
      id: "tip-pin-navigation",
      kind: "tip",
      title: "Pin your favorite pages",
      body: "Hover a sidebar item and use the pin icon to keep it at the top of your navigation.",
    },
  ];
}

export function unreadNotifications(
  notifications: ShellNotification[],
  readIds: string[],
): ShellNotification[] {
  return notifications.filter((notification) => !readIds.includes(notification.id));
}

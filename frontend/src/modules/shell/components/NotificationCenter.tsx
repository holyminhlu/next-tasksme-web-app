"use client";

import { useRouter } from "next/navigation";
import { CheckCheck, Info } from "lucide-react";
import {
  Badge,
  Button,
  Drawer,
  EmptyState,
} from "@/modules/design-system";
import { useShell } from "../ShellProvider";
import type { ShellNotification } from "../notifications";
import styles from "./NotificationCenter.module.css";

export function NotificationList({
  notifications,
  unreadIds,
  onMarkRead,
  onNavigate,
}: {
  notifications: ShellNotification[];
  unreadIds: string[];
  onMarkRead: (id: string) => void;
  onNavigate?: (href: string) => void;
}) {
  if (notifications.length === 0) {
    return (
      <EmptyState
        title="No notifications"
        description="You're all caught up. Workspace activity will appear here."
      />
    );
  }

  return (
    <ul className={styles.list}>
      {notifications.map((notification) => {
        const unread = unreadIds.includes(notification.id);

        return (
          <li
            key={notification.id}
            className={`${styles.item} ${unread ? styles.itemUnread : ""}`.trim()}
          >
            <div className={styles.itemHeader}>
              <span className={styles.itemTitle}>
                {unread && <span className={styles.unreadDot} aria-hidden />}
                {notification.title}
                {unread && <span className={styles.srOnly}>(unread)</span>}
              </span>
              <Badge tone={notification.kind === "system" ? "primary" : "neutral"}>
                {notification.kind === "system" ? "System" : "Tip"}
              </Badge>
            </div>
            <p className={styles.itemBody}>{notification.body}</p>
            <div className={styles.itemActions}>
              {unread && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onMarkRead(notification.id)}
                >
                  Mark as read
                </Button>
              )}
              {notification.href && onNavigate && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onNavigate(notification.href!)}
                >
                  Open
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function NotificationCenter() {
  const router = useRouter();
  const {
    notifications,
    unreadNotificationIds,
    notificationsOpen,
    setNotificationsOpen,
    markNotificationRead,
    markAllNotificationsRead,
  } = useShell();

  return (
    <Drawer
      open={notificationsOpen}
      onClose={() => setNotificationsOpen(false)}
      title="Notifications"
      headerActions={
        unreadNotificationIds.length > 0 ? (
          <Button
            size="sm"
            variant="ghost"
            iconLeft={<CheckCheck size={14} aria-hidden />}
            onClick={markAllNotificationsRead}
          >
            Mark all read
          </Button>
        ) : undefined
      }
      footer={
        <p className={styles.localNote}>
          <Info size={14} aria-hidden className={styles.localNoteIcon} />
          <span>
            These notifications are generated locally on this device. Real-time
            workspace notifications arrive with the backend feed in a later
            phase.
          </span>
        </p>
      }
    >
      <NotificationList
        notifications={notifications}
        unreadIds={unreadNotificationIds}
        onMarkRead={markNotificationRead}
        onNavigate={(href) => {
          setNotificationsOpen(false);
          router.push(href);
        }}
      />
    </Drawer>
  );
}

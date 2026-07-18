"use client";

import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import {
  Badge,
  Button,
  Drawer,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/modules/design-system";
import type { WorkspaceNotification } from "@/modules/notifications";
import { useShell } from "../ShellProvider";
import styles from "./NotificationCenter.module.css";

function typeLabel(type: string): string {
  if (type === "TASK_ASSIGNED") {
    return "Assignment";
  }

  return "Notice";
}

export function NotificationList({
  notifications,
  onMarkRead,
  onNavigate,
}: {
  notifications: WorkspaceNotification[];
  onMarkRead: (id: string) => void;
  onNavigate?: (href: string) => void;
}) {
  if (notifications.length === 0) {
    return (
      <EmptyState
        title="No notifications"
        description="You're all caught up. Assignment alerts for this workspace appear here."
      />
    );
  }

  return (
    <ul className={styles.list}>
      {notifications.map((notification) => {
        const unread = !notification.readAt;

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
              <Badge tone={unread ? "primary" : "neutral"}>
                {typeLabel(notification.type)}
              </Badge>
            </div>
            {notification.body && (
              <p className={styles.itemBody}>{notification.body}</p>
            )}
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
    notificationsLoading,
    notificationsError,
    unreadNotificationCount,
    notificationsOpen,
    setNotificationsOpen,
    markNotificationRead,
    markAllNotificationsRead,
    refreshNotifications,
  } = useShell();

  return (
    <Drawer
      open={notificationsOpen}
      onClose={() => setNotificationsOpen(false)}
      title="Notifications"
      headerActions={
        unreadNotificationCount > 0 ? (
          <Button
            size="sm"
            variant="ghost"
            iconLeft={<CheckCheck size={14} aria-hidden />}
            onClick={() => void markAllNotificationsRead()}
          >
            Mark all read
          </Button>
        ) : undefined
      }
    >
      {notificationsLoading ? (
        <LoadingState label="Loading notifications..." />
      ) : notificationsError ? (
        <ErrorState
          title="Couldn't load notifications"
          description={notificationsError}
          onRetry={() => void refreshNotifications()}
        />
      ) : (
        <NotificationList
          notifications={notifications}
          onMarkRead={(id) => void markNotificationRead(id)}
          onNavigate={(href) => {
            setNotificationsOpen(false);
            router.push(href);
          }}
        />
      )}
    </Drawer>
  );
}

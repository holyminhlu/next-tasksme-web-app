"use client";

import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import {
  Button,
  ErrorState,
  LoadingState,
} from "@/modules/design-system";
import { NotificationList, PageHeader, useShell } from "@/modules/shell";
import styles from "../app-pages.module.css";

export default function NotificationsPage() {
  const router = useRouter();
  const {
    notifications,
    notificationsLoading,
    notificationsError,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    refreshNotifications,
  } = useShell();

  return (
    <div className={styles.stack}>
      <PageHeader
        title="Notifications"
        description="Assignment alerts and activity for this workspace."
        actions={
          unreadNotificationCount > 0 ? (
            <Button
              variant="secondary"
              iconLeft={<CheckCheck size={16} aria-hidden />}
              onClick={() => void markAllNotificationsRead()}
            >
              Mark all read
            </Button>
          ) : undefined
        }
      />

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
          onNavigate={(href) => router.push(href)}
        />
      )}
    </div>
  );
}

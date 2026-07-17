"use client";

import { useRouter } from "next/navigation";
import { CheckCheck, Info } from "lucide-react";
import { Button } from "@/modules/design-system";
import { NotificationList, PageHeader, useShell } from "@/modules/shell";
import styles from "../app-pages.module.css";

export default function NotificationsPage() {
  const router = useRouter();
  const {
    notifications,
    unreadNotificationIds,
    markNotificationRead,
    markAllNotificationsRead,
  } = useShell();

  return (
    <div className={styles.stack}>
      <PageHeader
        title="Notifications"
        description="Activity and alerts for this workspace."
        actions={
          unreadNotificationIds.length > 0 ? (
            <Button
              variant="secondary"
              iconLeft={<CheckCheck size={16} aria-hidden />}
              onClick={markAllNotificationsRead}
            >
              Mark all read
            </Button>
          ) : undefined
        }
      />

      <p className={styles.noticeBanner}>
        <Info size={16} aria-hidden className={styles.bannerIcon} />
        <span>
          These notifications are generated locally on this device and read
          state is stored in your browser. Real-time workspace notifications
          arrive with the backend feed in a later phase.
        </span>
      </p>

      <NotificationList
        notifications={notifications}
        unreadIds={unreadNotificationIds}
        onMarkRead={markNotificationRead}
        onNavigate={(href) => router.push(href)}
      />
    </div>
  );
}

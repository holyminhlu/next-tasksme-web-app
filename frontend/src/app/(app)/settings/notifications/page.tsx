"use client";

import { Info } from "lucide-react";
import { Badge, Switch } from "@/modules/design-system";
import { useShell } from "@/modules/shell";
import styles from "../../app-pages.module.css";

export default function NotificationSettingsPage() {
  const { preferences, setNotificationPref } = useShell();
  const prefs = preferences.notificationPrefs;

  return (
    <div className={styles.stack}>
      <section className={styles.card} aria-labelledby="notif-prefs-heading">
        <div className={styles.row}>
          <h2 id="notif-prefs-heading" className={styles.cardTitle}>
            Notification preferences
          </h2>
          <Badge tone="warning">Stored locally</Badge>
        </div>
        <p className={styles.cardDescription}>
          Choose which notifications you want to see.
        </p>

        <p className={styles.noticeBanner}>
          <Info size={16} aria-hidden className={styles.bannerIcon} />
          <span>
            These preferences are saved in your browser for this workspace
            only. They will sync to your account once the notification API
            ships in a later phase — until then they don&apos;t affect emails
            or other devices.
          </span>
        </p>

        <div className={styles.form} style={{ marginTop: 16, maxWidth: 560 }}>
          <Switch
            label="Product updates"
            hint="News about new features and improvements."
            checked={prefs.productUpdates}
            onChange={(checked) => setNotificationPref("productUpdates", checked)}
          />
          <Switch
            label="Task reminders"
            hint="Reminders about upcoming and overdue tasks."
            checked={prefs.taskReminders}
            onChange={(checked) => setNotificationPref("taskReminders", checked)}
          />
          <Switch
            label="Mentions"
            hint="When someone mentions you in a comment."
            checked={prefs.mentionAlerts}
            onChange={(checked) => setNotificationPref("mentionAlerts", checked)}
          />
        </div>
      </section>
    </div>
  );
}

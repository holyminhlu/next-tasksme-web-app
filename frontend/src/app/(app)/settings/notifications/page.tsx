"use client";

import { useCallback, useEffect, useState } from "react";
import { Info } from "lucide-react";
import { useAuth } from "@/modules/auth";
import {
  Badge,
  ErrorState,
  LoadingState,
  Switch,
  useToast,
} from "@/modules/design-system";
import {
  notificationsService,
  type NotificationPreference,
} from "@/modules/notifications";
import { useShell } from "@/modules/shell";
import styles from "../../app-pages.module.css";

export default function NotificationSettingsPage() {
  const { selectedWorkspace } = useAuth();
  const { preferences, setNotificationPref } = useShell();
  const { toast } = useToast();
  const prefs = preferences.notificationPrefs;
  const workspaceId = selectedWorkspace?.id ?? null;

  const [taskAssigned, setTaskAssigned] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState(true);

  const loadPreference = useCallback(async () => {
    if (!workspaceId) {
      return;
    }

    setLoading(true);
    setError(null);

    const result = await notificationsService.getNotificationPreference(
      workspaceId,
    );

    setLoading(false);

    if (!result.ok) {
      if (result.code === "NOT_FOUND") {
        setAvailable(false);
        setError(null);
        return;
      }

      setAvailable(true);
      setError(result.message);
      return;
    }

    setAvailable(true);
    setTaskAssigned(result.data.taskAssigned);
  }, [workspaceId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load synced preference
    void loadPreference();
  }, [loadPreference]);

  async function handleTaskAssignedChange(checked: boolean) {
    if (!workspaceId || saving) {
      return;
    }

    const previous = taskAssigned;
    setTaskAssigned(checked);
    setSaving(true);

    const result = await notificationsService.updateNotificationPreference(
      workspaceId,
      { taskAssigned: checked } satisfies NotificationPreference,
    );

    setSaving(false);

    if (!result.ok) {
      setTaskAssigned(previous);
      toast({
        title: "Couldn't save preference",
        description: result.message,
        tone: "error",
      });
      return;
    }

    setTaskAssigned(result.data.taskAssigned);
    toast({
      title: "Preference saved",
      description: result.data.taskAssigned
        ? "You'll get alerts when tasks are assigned to you."
        : "Task assignment alerts are turned off for this workspace.",
      tone: "success",
    });
  }

  return (
    <div className={styles.stack}>
      <section className={styles.card} aria-labelledby="workspace-notif-heading">
        <div className={styles.row}>
          <h2 id="workspace-notif-heading" className={styles.cardTitle}>
            Workspace notifications
          </h2>
          <Badge tone="primary">Synced</Badge>
        </div>
        <p className={styles.cardDescription}>
          These preferences sync with your account for this workspace.
        </p>

        {loading ? (
          <LoadingState label="Loading preferences..." />
        ) : error ? (
          <ErrorState
            title="Couldn't load preferences"
            description={error}
            onRetry={() => void loadPreference()}
          />
        ) : !available ? (
          <p className={styles.noticeBanner}>
            <Info size={16} aria-hidden className={styles.bannerIcon} />
            <span>
              Assignment notification preferences aren&apos;t available on this
              server yet. Local browser preferences below still apply on this
              device only.
            </span>
          </p>
        ) : (
          <div className={styles.form} style={{ marginTop: 16, maxWidth: 560 }}>
            <Switch
              label="Task assigned"
              hint="Notify me when someone assigns a task to me in this workspace."
              checked={taskAssigned}
              disabled={saving}
              onChange={(checked) => void handleTaskAssignedChange(checked)}
            />
          </div>
        )}
      </section>

      <section className={styles.card} aria-labelledby="local-notif-heading">
        <div className={styles.row}>
          <h2 id="local-notif-heading" className={styles.cardTitle}>
            Local preferences
          </h2>
          <Badge tone="warning">This device</Badge>
        </div>
        <p className={styles.cardDescription}>
          Browser-only toggles that do not sync to the server.
        </p>

        <p className={styles.noticeBanner}>
          <Info size={16} aria-hidden className={styles.bannerIcon} />
          <span>
            These preferences are saved in your browser for this workspace only.
            They do not affect emails or other devices.
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

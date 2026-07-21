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

const DEFAULT_PREFS: NotificationPreference = {
  taskAssigned: true,
  taskMentioned: true,
  taskUnblocked: true,
  recurrenceCreated: true,
  recurrenceSkipped: true,
  slaWarning: true,
  slaBreached: true,
  riskEscalated: true,
  projectStatusChanged: true,
};

const WORKSPACE_PREF_FIELDS: Array<{
  key: keyof NotificationPreference;
  label: string;
  hint: string;
}> = [
  {
    key: "taskAssigned",
    label: "Task assigned",
    hint: "When someone assigns a task to me in this workspace.",
  },
  {
    key: "taskMentioned",
    label: "Task mentioned",
    hint: "When someone mentions me on a task.",
  },
  {
    key: "taskUnblocked",
    label: "Task unblocked",
    hint: "When a task becomes unblocked after dependencies complete.",
  },
  {
    key: "recurrenceCreated",
    label: "Recurring task created",
    hint: "When a recurring task occurrence is created and assigned to me.",
  },
  {
    key: "recurrenceSkipped",
    label: "Recurring task skipped",
    hint: "When a recurrence is skipped because an earlier occurrence is still open.",
  },
  {
    key: "slaWarning",
    label: "SLA warning",
    hint: "When a task SLA is approaching its due time.",
  },
  {
    key: "slaBreached",
    label: "SLA breached",
    hint: "When a task SLA is breached.",
  },
  {
    key: "riskEscalated",
    label: "Risk escalated",
    hint: "When a task risk level increases.",
  },
  {
    key: "projectStatusChanged",
    label: "Project status changed",
    hint: "When a project you manage changes status.",
  },
];

export default function NotificationSettingsPage() {
  const { selectedWorkspace } = useAuth();
  const { preferences, setNotificationPref } = useShell();
  const { toast } = useToast();
  const prefs = preferences.notificationPrefs;
  const workspaceId = selectedWorkspace?.id ?? null;

  const [workspacePrefs, setWorkspacePrefs] =
    useState<NotificationPreference>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<keyof NotificationPreference | null>(
    null,
  );
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
    setWorkspacePrefs({ ...DEFAULT_PREFS, ...result.data });
  }, [workspaceId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load synced preference
    void loadPreference();
  }, [loadPreference]);

  async function handleWorkspacePrefChange(
    key: keyof NotificationPreference,
    checked: boolean,
  ) {
    if (!workspaceId || savingKey) {
      return;
    }

    const previous = workspacePrefs;
    const next = { ...workspacePrefs, [key]: checked };
    setWorkspacePrefs(next);
    setSavingKey(key);

    const result = await notificationsService.updateNotificationPreference(
      workspaceId,
      next,
    );

    setSavingKey(null);

    if (!result.ok) {
      setWorkspacePrefs(previous);
      toast({
        title: "Couldn't save preference",
        description: result.message,
        tone: "error",
      });
      return;
    }

    setWorkspacePrefs({ ...DEFAULT_PREFS, ...result.data });
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
              Workspace notification preferences aren&apos;t available on this
              server yet. Local browser preferences below still apply on this
              device only.
            </span>
          </p>
        ) : (
          <div className={styles.form} style={{ marginTop: 16, maxWidth: 560 }}>
            {WORKSPACE_PREF_FIELDS.map((field) => (
              <Switch
                key={field.key}
                label={field.label}
                hint={field.hint}
                checked={workspacePrefs[field.key] ?? true}
                disabled={savingKey !== null}
                onChange={(checked) =>
                  void handleWorkspacePrefChange(field.key, checked)
                }
              />
            ))}
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

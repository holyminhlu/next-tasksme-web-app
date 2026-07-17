"use client";

import { useCallback, useEffect, useState } from "react";
import { hasPermission, useAuth } from "@/modules/auth";
import {
  listModules,
  updateModules,
} from "@/modules/onboarding/onboarding.service";
import type { WorkspaceModule } from "@/modules/onboarding/onboarding.types";
import {
  Badge,
  ErrorState,
  ForbiddenState,
  Skeleton,
  Switch,
  useToast,
} from "@/modules/design-system";
import { useShell } from "@/modules/shell";
import styles from "../../app-pages.module.css";

export default function ModulesSettingsPage() {
  const { permissions, selectedWorkspace } = useAuth();
  const { refreshModules } = useShell();
  const { toast } = useToast();

  const workspaceId = selectedWorkspace?.id;
  const canRead = hasPermission(permissions, "workspace:read");
  const canManage = hasPermission(permissions, "modules:manage");

  const [modules, setModules] = useState<WorkspaceModule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId) {
      return;
    }

    const result = await listModules(workspaceId);

    if (!result.success) {
      setError(result.error.message);
      return;
    }

    setModules(result.data);
    setError(null);
  }, [workspaceId]);

  useEffect(() => {
    if (canRead) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch on mount
      void load();
    }
  }, [canRead, load]);

  if (!canRead) {
    return <ForbiddenState />;
  }

  async function handleToggle(moduleRecord: WorkspaceModule, enabled: boolean) {
    if (!workspaceId || savingKey) {
      return;
    }

    setSavingKey(moduleRecord.moduleKey);

    const result = await updateModules(workspaceId, {
      modules: [{ moduleKey: moduleRecord.moduleKey, enabled }],
    });

    setSavingKey(null);

    if (!result.success) {
      toast({
        title: "Could not update module",
        description: result.error.message,
        tone: "error",
      });
      return;
    }

    setModules(result.data);
    toast({
      title: enabled ? "Module enabled" : "Module disabled",
      description: `${moduleRecord.name} is now ${enabled ? "on" : "off"} for this workspace.`,
      tone: "success",
    });
    // Keep sidebar/command palette module filtering in sync.
    await refreshModules();
  }

  return (
    <div className={styles.stack}>
      <section className={styles.card} aria-labelledby="modules-heading">
        <h2 id="modules-heading" className={styles.cardTitle}>
          Workspace modules
        </h2>
        <p className={styles.cardDescription}>
          Enable the features this workspace needs. Core modules can&apos;t be
          turned off.
          {!canManage &&
            " You have read-only access — ask an admin to change modules."}
        </p>

        {error ? (
          <ErrorState
            title="Could not load modules"
            description={error}
            onRetry={() => void load()}
          />
        ) : modules === null ? (
          <div className={styles.skeletonRows} aria-hidden>
            <Skeleton height={48} />
            <Skeleton height={48} />
            <Skeleton height={48} />
            <Skeleton height={48} />
          </div>
        ) : (
          <div className={styles.form} style={{ maxWidth: 560 }}>
            {modules.map((moduleRecord) => (
              <div key={moduleRecord.moduleKey} className={styles.row}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Switch
                    label={moduleRecord.name}
                    hint={moduleRecord.description ?? undefined}
                    checked={moduleRecord.enabled}
                    disabled={
                      !canManage ||
                      moduleRecord.core ||
                      savingKey === moduleRecord.moduleKey
                    }
                    onChange={(enabled) =>
                      void handleToggle(moduleRecord, enabled)
                    }
                  />
                </div>
                {moduleRecord.core && <Badge tone="neutral">Core</Badge>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { CheckSquare, Plus } from "lucide-react";
import { hasPermission, useAuth } from "@/modules/auth";
import { Button, EmptyState, ForbiddenState } from "@/modules/design-system";
import { PageHeader, useShell } from "@/modules/shell";
import styles from "../app-pages.module.css";

export default function MyTasksPage() {
  const { permissions } = useAuth();
  const { setQuickCreate, navContext } = useShell();

  if (!hasPermission(permissions, "tasks:read")) {
    return (
      <div className={styles.stack}>
        <PageHeader title="My tasks" />
        <ForbiddenState />
      </div>
    );
  }

  const modulesKnown = navContext.enabledModuleKeys !== null;
  const tasksModuleDisabled =
    modulesKnown && !navContext.enabledModuleKeys!.includes("tasks");

  return (
    <div className={styles.stack}>
      <PageHeader
        title="My tasks"
        description="Tasks assigned to you across all projects in this workspace."
        actions={
          hasPermission(permissions, "tasks:create") && !tasksModuleDisabled ? (
            <Button
              iconLeft={<Plus size={16} aria-hidden />}
              onClick={() => setQuickCreate("task")}
            >
              New task
            </Button>
          ) : undefined
        }
      />

      {tasksModuleDisabled ? (
        <EmptyState
          title="Tasks module is disabled"
          description={
            <>
              The tasks module is turned off for this workspace. An admin can
              re-enable it under{" "}
              <Link href="/settings/modules">Settings → Modules</Link>.
            </>
          }
        />
      ) : (
        <EmptyState
          icon={<CheckSquare size={22} />}
          title="No tasks yet"
          description="Task lists, filters and boards land here in a later phase. The tasks API isn't connected yet, so nothing can be loaded or saved from this page."
          actions={
            hasPermission(permissions, "tasks:create") ? (
              <Button variant="secondary" onClick={() => setQuickCreate("task")}>
                Preview task creation
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}

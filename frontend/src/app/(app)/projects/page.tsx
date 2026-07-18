"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { FolderKanban, Plus, Users } from "lucide-react";
import { hasPermission, useAuth } from "@/modules/auth";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
} from "@/modules/design-system";
import { useWidget } from "@/modules/dashboard";
import {
  ProjectMembersDialog,
  canManagePrivateProjectMembers,
  tasksService,
  type ProjectRecord,
} from "@/modules/tasks";
import { PageHeader, useShell } from "@/modules/shell";
import styles from "../app-pages.module.css";
import pageStyles from "./projects.module.css";

export default function ProjectsPage() {
  const { profile, selectedWorkspace, permissions } = useAuth();
  const { setQuickCreate, navContext } = useShell();

  const workspaceId = selectedWorkspace?.id ?? null;
  const canRead = hasPermission(permissions, "projects:read");
  const canReadTasks = hasPermission(permissions, "tasks:read");

  const fetcher = useCallback(
    () => tasksService.listProjects(workspaceId ?? ""),
    [workspaceId],
  );
  const state = useWidget(workspaceId && canRead ? fetcher : null);
  const [managing, setManaging] = useState<ProjectRecord | null>(null);
  const [overrides, setOverrides] = useState<Record<string, ProjectRecord>>({});

  if (!canRead) {
    return (
      <div className={styles.stack}>
        <PageHeader title="Projects" />
        <ForbiddenState />
      </div>
    );
  }

  const modulesKnown = navContext.enabledModuleKeys !== null;
  const projectsModuleDisabled =
    modulesKnown && !navContext.enabledModuleKeys!.includes("projects");

  const projects = (state.data ?? []).map(
    (project) => overrides[project.id] ?? project,
  );

  return (
    <div className={styles.stack}>
      <PageHeader
        title="Projects"
        description="Organize related work into projects."
        actions={
          hasPermission(permissions, "projects:create") &&
          !projectsModuleDisabled ? (
            <Button
              iconLeft={<Plus size={16} aria-hidden />}
              onClick={() => setQuickCreate("project")}
            >
              New project
            </Button>
          ) : undefined
        }
      />

      {projectsModuleDisabled ? (
        <EmptyState
          title="Projects module is disabled"
          description={
            <>
              The projects module is turned off for this workspace. An admin
              can re-enable it under{" "}
              <Link href="/settings/modules">Settings → Modules</Link>.
            </>
          }
        />
      ) : state.loading ? (
        <LoadingState label="Loading projects..." />
      ) : state.error ? (
        <ErrorState
          title="Couldn't load projects"
          description={state.error.message}
          onRetry={state.reload}
        />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban size={22} />}
          title="No projects yet"
          description="Projects group related tasks so your team can find work faster. Create the first one to get started."
          actions={
            hasPermission(permissions, "projects:create") ? (
              <Button onClick={() => setQuickCreate("project")}>
                New project
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className={pageStyles.resultsSummary} aria-live="polite">
            {projects.length} project{projects.length === 1 ? "" : "s"}
            {state.refreshing ? " · refreshing…" : ""}
          </p>
          <div className={pageStyles.grid}>
            {projects.map((project) => {
              const isActive = project.status.toUpperCase() === "ACTIVE";
              const isPrivate = project.visibility === "PRIVATE";
              const canManage = canManagePrivateProjectMembers({
                roleKey: selectedWorkspace?.roleKey,
                project,
                userId: profile?.id,
              });

              return (
                <article key={project.id} className={pageStyles.projectCard}>
                  <div className={pageStyles.projectHeader}>
                    <h2 className={pageStyles.projectName}>{project.name}</h2>
                    <div className={pageStyles.badgeRow}>
                      <Badge tone={isActive ? "success" : "neutral"}>
                        {isActive ? "Active" : project.status}
                      </Badge>
                      {isPrivate && <Badge tone="warning">Private</Badge>}
                    </div>
                  </div>
                  {project.description && (
                    <p className={pageStyles.projectDescription}>
                      {project.description}
                    </p>
                  )}
                  <div className={pageStyles.projectMeta}>
                    {isPrivate && (
                      <span>
                        {project.memberIds.length > 0
                          ? `${project.memberIds.length} member${project.memberIds.length === 1 ? "" : "s"}`
                          : "Private"}
                      </span>
                    )}
                    {project.openTasks !== null && (
                      <span>{project.openTasks} open</span>
                    )}
                    {project.totalTasks !== null && (
                      <span>{project.totalTasks} total tasks</span>
                    )}
                  </div>
                  <div className={pageStyles.projectFooter}>
                    {canReadTasks && (
                      <Link
                        className={pageStyles.projectLink}
                        href={`/my-tasks?projectId=${encodeURIComponent(project.id)}`}
                      >
                        View tasks
                      </Link>
                    )}
                    {canManage && (
                      <Button
                        size="sm"
                        variant="secondary"
                        iconLeft={<Users size={14} aria-hidden />}
                        onClick={() => setManaging(project)}
                      >
                        Manage members
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      <ProjectMembersDialog
        project={managing}
        open={Boolean(managing)}
        onClose={() => setManaging(null)}
        onUpdated={(updated) => {
          setOverrides((current) => ({ ...current, [updated.id]: updated }));
          state.reload();
        }}
      />
    </div>
  );
}

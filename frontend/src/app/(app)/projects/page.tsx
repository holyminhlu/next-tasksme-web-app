"use client";

import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
import { hasPermission, useAuth } from "@/modules/auth";
import { Button, EmptyState, ForbiddenState } from "@/modules/design-system";
import { PageHeader, useShell } from "@/modules/shell";
import styles from "../app-pages.module.css";

export default function ProjectsPage() {
  const { permissions } = useAuth();
  const { setQuickCreate, navContext } = useShell();

  if (!hasPermission(permissions, "projects:read")) {
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
      ) : (
        <section className={styles.card} aria-labelledby="recent-projects">
          <h2 id="recent-projects" className={styles.cardTitle}>
            Recent projects
          </h2>
          <p className={styles.cardDescription}>
            Projects you visit will appear here for quick access.
          </p>
          <EmptyState
            plain
            icon={<FolderKanban size={22} />}
            title="No recent projects"
            description="Project browsing arrives with the projects API in a later phase. Once connected, your recently viewed projects will show up here."
          />
        </section>
      )}
    </div>
  );
}

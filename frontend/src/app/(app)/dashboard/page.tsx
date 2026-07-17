"use client";

import Link from "next/link";
import { FolderKanban, Plus, UserPlus } from "lucide-react";
import { Can, useAuth } from "@/modules/auth";
import { Badge, Button } from "@/modules/design-system";
import { PageHeader, useShell } from "@/modules/shell";
import styles from "../app-pages.module.css";

export default function DashboardPage() {
  const { user, profile, workspaces, selectedWorkspace, permissions } =
    useAuth();
  const { setQuickCreate } = useShell();

  const isOrganization = selectedWorkspace?.type === "ORGANIZATION";

  return (
    <div className={styles.stack}>
      <PageHeader
        title={`Welcome back, ${user?.fullName?.split(" ")[0] ?? "there"}`}
        description={
          selectedWorkspace
            ? `You're working in ${selectedWorkspace.name}.`
            : "Select a workspace to get started."
        }
        actions={
          <>
            <Can permission="tasks:create">
              <Button
                iconLeft={<Plus size={16} aria-hidden />}
                onClick={() => setQuickCreate("task")}
              >
                New task
              </Button>
            </Can>
            <Can permission="projects:create">
              <Button
                variant="secondary"
                iconLeft={<FolderKanban size={16} aria-hidden />}
                onClick={() => setQuickCreate("project")}
              >
                New project
              </Button>
            </Can>
          </>
        }
      />

      <div className={styles.grid}>
        <section className={styles.card} aria-labelledby="dashboard-account">
          <h2 id="dashboard-account" className={styles.cardTitle}>
            Account
          </h2>
          <dl className={styles.definitionList}>
            <dt>Name</dt>
            <dd>{profile?.fullName ?? "—"}</dd>
            <dt>Email</dt>
            <dd>{profile?.email ?? "—"}</dd>
            <dt>Status</dt>
            <dd>
              <Badge tone={profile?.status === "ACTIVE" ? "success" : "warning"}>
                {profile?.status ?? "UNKNOWN"}
              </Badge>
            </dd>
          </dl>
        </section>

        <section className={styles.card} aria-labelledby="dashboard-workspace">
          <h2 id="dashboard-workspace" className={styles.cardTitle}>
            Active workspace
          </h2>
          {selectedWorkspace ? (
            <dl className={styles.definitionList}>
              <dt>Name</dt>
              <dd>{selectedWorkspace.name}</dd>
              <dt>Type</dt>
              <dd>
                <Badge tone={isOrganization ? "primary" : "neutral"}>
                  {isOrganization ? "Organization" : "Personal"}
                </Badge>
              </dd>
              <dt>Your role</dt>
              <dd>{selectedWorkspace.roleKey}</dd>
            </dl>
          ) : (
            <p className={styles.muted}>No workspace selected.</p>
          )}
        </section>
      </div>

      <section className={styles.card} aria-labelledby="dashboard-workspaces">
        <h2 id="dashboard-workspaces" className={styles.cardTitle}>
          Your workspaces
        </h2>
        {workspaces.length === 0 ? (
          <p className={styles.muted}>No workspaces yet.</p>
        ) : (
          <dl className={styles.definitionList}>
            {workspaces.map((workspace) => (
              <div key={workspace.id} style={{ display: "contents" }}>
                <dt>{workspace.name}</dt>
                <dd>
                  {workspace.type === "PERSONAL" ? "Personal" : "Organization"} ·{" "}
                  {workspace.roleKey}
                  {workspace.id === selectedWorkspace?.id && (
                    <>
                      {" "}
                      <Badge tone="primary">Active</Badge>
                    </>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <Can permission="members:invite">
        {isOrganization && (
          <section className={styles.card} aria-labelledby="dashboard-team">
            <h2 id="dashboard-team" className={styles.cardTitle}>
              Grow your team
            </h2>
            <p className={styles.cardDescription}>
              You can invite members to this workspace.
            </p>
            <div className={styles.row}>
              <Button
                variant="secondary"
                iconLeft={<UserPlus size={16} aria-hidden />}
                onClick={() => setQuickCreate("invite")}
              >
                Invite member
              </Button>
              <Link href="/settings/members" className={styles.muted}>
                Manage members
              </Link>
            </div>
          </section>
        )}
      </Can>

      <p className={styles.muted}>
        Effective permissions: {permissions.join(", ") || "none"}
      </p>
    </div>
  );
}

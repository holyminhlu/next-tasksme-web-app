"use client";

import Link from "next/link";
import { Can, useAuth } from "@/modules/auth";
import styles from "@/modules/auth/auth.module.css";

export default function DashboardPage() {
  const { user, profile, workspaces, selectedWorkspace, permissions } =
    useAuth();

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h1>Dashboard</h1>
        <p>Signed in as {user?.fullName ?? user?.email}</p>
      </div>

      <div className={styles.form}>
        <div>
          <span className={styles.muted}>Email</span>
          <p>{profile?.email}</p>
        </div>

        <div>
          <span className={styles.muted}>Status</span>
          <p>{profile?.status}</p>
        </div>

        <div>
          <span className={styles.muted}>Active workspace</span>
          <p>
            {selectedWorkspace
              ? `${selectedWorkspace.name} (${selectedWorkspace.type === "PERSONAL" ? "personal" : "organization"} · ${selectedWorkspace.roleKey})`
              : "None selected"}
          </p>
        </div>

        <div>
          <span className={styles.muted}>Workspaces</span>
          {workspaces.length === 0 ? (
            <p>No workspaces</p>
          ) : (
            <ul className={styles.workspaceList}>
              {workspaces.map((workspace) => (
                <li key={workspace.id} className={styles.muted}>
                  {workspace.name} · {workspace.roleKey}
                </li>
              ))}
            </ul>
          )}
        </div>

        <Can permission="members:invite">
          {selectedWorkspace?.type === "ORGANIZATION" && (
            <p className={styles.success}>
              You can invite members in this workspace.{" "}
              <Link href="/members">Manage members</Link>
            </p>
          )}
        </Can>

        <p className={styles.muted}>
          Effective permissions: {permissions.join(", ") || "none"}
        </p>

        <Link href="/" className={styles.secondaryButton}>
          View health status
        </Link>
      </div>
    </div>
  );
}

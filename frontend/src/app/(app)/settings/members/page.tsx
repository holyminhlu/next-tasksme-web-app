"use client";

import { useCallback, useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { get } from "@/lib/api/client";
import {
  Can,
  hasPermission,
  useAuth,
  type WorkspaceMemberSummary,
} from "@/modules/auth";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  ForbiddenState,
  Skeleton,
  Table,
} from "@/modules/design-system";
import { useShell } from "@/modules/shell";
import styles from "../../app-pages.module.css";

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

export default function MembersSettingsPage() {
  const { permissions, selectedWorkspace } = useAuth();
  const { setQuickCreate } = useShell();

  const workspaceId = selectedWorkspace?.id;
  const isPersonal = selectedWorkspace?.type === "PERSONAL";
  const canRead = hasPermission(permissions, "members:read");

  const [members, setMembers] = useState<WorkspaceMemberSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    if (!workspaceId) {
      return;
    }

    const result = await get<WorkspaceMemberSummary[]>(
      `/workspaces/${workspaceId}/members`,
    );

    if (!result.success) {
      setError(result.error.message);
      return;
    }

    setMembers(result.data);
    setError(null);
  }, [workspaceId]);

  useEffect(() => {
    if (canRead && !isPersonal) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch on mount
      void loadMembers();
    }
  }, [canRead, isPersonal, loadMembers]);

  if (isPersonal) {
    return (
      <EmptyState
        title="Members are an organization feature"
        description="Personal workspaces have a single member — you. Create or switch to an organization workspace to collaborate with a team."
      />
    );
  }

  if (!canRead) {
    return <ForbiddenState />;
  }

  return (
    <div className={styles.stack}>
      <section className={styles.card} aria-labelledby="members-heading">
        <div className={`${styles.row} ${styles.spaceBetween}`}>
          <div>
            <h2 id="members-heading" className={styles.cardTitle}>
              Members
            </h2>
            <p className={styles.cardDescription}>
              People with access to this workspace.
            </p>
          </div>
          <Can permission="members:invite">
            <Button
              iconLeft={<UserPlus size={16} aria-hidden />}
              onClick={() => setQuickCreate("invite")}
            >
              Invite member
            </Button>
          </Can>
        </div>

        {error ? (
          <ErrorState
            title="Could not load members"
            description={error}
            onRetry={() => void loadMembers()}
          />
        ) : members === null ? (
          <div className={styles.skeletonRows} aria-hidden>
            <Skeleton height={40} />
            <Skeleton height={40} />
            <Skeleton height={40} />
          </div>
        ) : members.length === 0 ? (
          <EmptyState
            title="No members yet"
            description="Invite teammates to start collaborating."
          />
        ) : (
          <Table aria-label="Workspace members">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td>{member.user.fullName}</td>
                  <td>{member.user.email}</td>
                  <td>
                    <Badge tone={member.role.key === "owner" ? "primary" : "neutral"}>
                      {member.role.name ?? member.role.key}
                    </Badge>
                  </td>
                  <td>
                    <Badge tone={member.status === "ACTIVE" ? "success" : "warning"}>
                      {member.status}
                    </Badge>
                  </td>
                  <td>{formatDate(member.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      <p className={styles.muted}>
        Role changes and member removal arrive with the member management API
        in a later phase.
      </p>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
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
  Select,
  Skeleton,
  Table,
  useToast,
} from "@/modules/design-system";
import {
  listMembers,
  removeMember,
  updateMemberRole,
} from "@/modules/workspaces";
import { useShell } from "@/modules/shell";
import styles from "../../app-pages.module.css";

const ASSIGNABLE_ROLES = ["admin", "manager", "member"] as const;

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

export default function MembersSettingsPage() {
  const { permissions, profile, selectedWorkspace } = useAuth();
  const { setQuickCreate } = useShell();
  const { toast } = useToast();

  const workspaceId = selectedWorkspace?.id;
  const isPersonal = selectedWorkspace?.type === "PERSONAL";
  const canRead = hasPermission(permissions, "members:read");
  const canUpdate = hasPermission(permissions, "members:update");
  const canRemove = hasPermission(permissions, "members:remove");

  const [members, setMembers] = useState<WorkspaceMemberSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    if (!workspaceId) {
      return;
    }

    const result = await listMembers(workspaceId);

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

  async function handleRoleChange(member: WorkspaceMemberSummary, roleKey: string) {
    if (!workspaceId || member.role.key === roleKey || busyMemberId) {
      return;
    }

    setBusyMemberId(member.id);
    const result = await updateMemberRole(workspaceId, member.id, roleKey);
    setBusyMemberId(null);

    if (!result.success) {
      toast({
        title: "Could not update role",
        description: result.error.message,
        tone: "error",
      });
      return;
    }

    await loadMembers();
    toast({
      title: "Role updated",
      description: `${member.user.fullName} is now ${roleKey}.`,
      tone: "success",
    });
  }

  async function handleRemove(member: WorkspaceMemberSummary) {
    if (!workspaceId || busyMemberId) {
      return;
    }

    const confirmed = window.confirm(
      `Remove ${member.user.fullName} from this workspace?`,
    );
    if (!confirmed) {
      return;
    }

    setBusyMemberId(member.id);
    const result = await removeMember(workspaceId, member.id);
    setBusyMemberId(null);

    if (!result.success) {
      toast({
        title: "Could not remove member",
        description: result.error.message,
        tone: "error",
      });
      return;
    }

    await loadMembers();
    toast({
      title: "Member removed",
      description: `${member.user.fullName} no longer has access.`,
      tone: "success",
    });
  }

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
                {(canUpdate || canRemove) && <th scope="col">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const isOwner = member.role.key === "owner";
                const isSelf = member.user.id === profile?.id;
                const isBusy = busyMemberId === member.id;

                return (
                  <tr key={member.id}>
                    <td>{member.user.fullName}</td>
                    <td>{member.user.email}</td>
                    <td>
                      {canUpdate && !isOwner && !isSelf ? (
                        <Select
                          aria-label={`Role for ${member.user.fullName}`}
                          value={member.role.key}
                          disabled={isBusy}
                          onChange={(event) =>
                            void handleRoleChange(member, event.target.value)
                          }
                        >
                          {ASSIGNABLE_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Badge
                          tone={isOwner ? "primary" : "neutral"}
                        >
                          {member.role.name ?? member.role.key}
                        </Badge>
                      )}
                    </td>
                    <td>
                      <Badge
                        tone={member.status === "ACTIVE" ? "success" : "warning"}
                      >
                        {member.status}
                      </Badge>
                    </td>
                    <td>{formatDate(member.createdAt)}</td>
                    {(canUpdate || canRemove) && (
                      <td>
                        {canRemove && !isOwner && !isSelf ? (
                          <Button
                            variant="dangerOutline"
                            size="sm"
                            loading={isBusy}
                            onClick={() => void handleRemove(member)}
                          >
                            Remove
                          </Button>
                        ) : (
                          <span className={styles.muted}>—</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  );
}

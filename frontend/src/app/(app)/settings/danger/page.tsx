"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { TriangleAlert } from "lucide-react";
import {
  hasPermission,
  useAuth,
  type WorkspaceMemberSummary,
} from "@/modules/auth";
import {
  Badge,
  Button,
  ForbiddenState,
  FormField,
  LoadingState,
  Select,
  useToast,
} from "@/modules/design-system";
import { listMembers, transferOwnership } from "@/modules/workspaces";
import styles from "../../app-pages.module.css";

export default function DangerZoneSettingsPage() {
  const { permissions, profile, refreshProfile, selectedWorkspace } = useAuth();
  const { toast } = useToast();

  const workspaceId = selectedWorkspace?.id;
  const canUpdate = hasPermission(permissions, "workspace:update");
  const canTransfer = hasPermission(permissions, "ownership:transfer");
  const isOrganization = selectedWorkspace?.type === "ORGANIZATION";

  const [members, setMembers] = useState<WorkspaceMemberSummary[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [targetMemberId, setTargetMemberId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    if (!workspaceId || !canTransfer || !isOrganization) {
      return;
    }

    setLoadingMembers(true);
    const result = await listMembers(workspaceId);
    setLoadingMembers(false);

    if (!result.success) {
      setError(result.error.message);
      return;
    }

    const eligible = result.data.filter(
      (member) =>
        member.status === "ACTIVE" &&
        member.user.id !== profile?.id &&
        member.role.key !== "owner",
    );
    setMembers(eligible);
    setTargetMemberId((current) => current || eligible[0]?.id || "");
    setError(null);
  }, [workspaceId, canTransfer, isOrganization, profile?.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch on mount
    void loadMembers();
  }, [loadMembers]);

  async function handleTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workspaceId || !targetMemberId || submitting) {
      return;
    }

    const confirmed = window.confirm(
      "Transfer ownership to the selected member? You will become an admin afterward.",
    );
    if (!confirmed) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await transferOwnership(workspaceId, {
      memberId: targetMemberId,
    });

    setSubmitting(false);

    if (!result.success) {
      setError(result.error.message);
      return;
    }

    await refreshProfile();
    toast({
      title: "Ownership transferred",
      description: "You are now an admin in this workspace.",
      tone: "success",
    });
  }

  if (!canUpdate) {
    return <ForbiddenState />;
  }

  return (
    <div className={styles.stack}>
      <p className={styles.warningBanner}>
        <TriangleAlert size={16} aria-hidden className={styles.bannerIcon} />
        <span>
          Actions in this section are destructive. Workspace deletion is not
          available yet — only ownership transfer can be executed here.
        </span>
      </p>

      {isOrganization && canTransfer && (
        <section
          className={`${styles.card} ${styles.dangerCard}`}
          aria-labelledby="transfer-heading"
        >
          <h2 id="transfer-heading" className={styles.cardTitle}>
            Transfer ownership
          </h2>
          <p className={styles.cardDescription}>
            Hand this workspace over to another active member. You&apos;ll become
            an admin after the transfer.
          </p>

          {error && (
            <p className={styles.errorBanner} role="alert">
              {error}
            </p>
          )}

          {loadingMembers ? (
            <LoadingState label="Loading members…" />
          ) : members.length === 0 ? (
            <p className={styles.muted}>
              No eligible members found. Invite another member before
              transferring ownership.
            </p>
          ) : (
            <form className={styles.form} onSubmit={handleTransfer}>
              <FormField label="New owner" required>
                {(props) => (
                  <Select
                    {...props}
                    value={targetMemberId}
                    onChange={(event) => setTargetMemberId(event.target.value)}
                    required
                  >
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.user.fullName} ({member.user.email}) —{" "}
                        {member.role.name ?? member.role.key}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              <Button
                type="submit"
                variant="dangerOutline"
                loading={submitting}
                disabled={!targetMemberId}
              >
                Transfer ownership
              </Button>
            </form>
          )}
        </section>
      )}

      <section
        className={`${styles.card} ${styles.dangerCard}`}
        aria-labelledby="delete-heading"
      >
        <div className={styles.row}>
          <h2 id="delete-heading" className={styles.cardTitle}>
            Delete workspace
          </h2>
          <Badge tone="warning">API not yet available</Badge>
        </div>
        <p className={styles.cardDescription}>
          Permanently delete {selectedWorkspace?.name ?? "this workspace"} and
          all of its projects, tasks and members. This cannot be undone.
        </p>
        <Button
          variant="danger"
          disabled
          title="Workspace deletion API not yet available"
        >
          Delete workspace
        </Button>
      </section>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/modules/auth";
import {
  Button,
  Checkbox,
  Dialog,
  EmptyState,
  ErrorState,
  LoadingState,
  TextInput,
  useToast,
} from "@/modules/design-system";
import { listMembers } from "@/modules/workspaces/members.service";
import {
  initialsFromName,
  projectMembersToCandidates,
  tasksService,
  type ProjectMemberSummary,
  type ProjectRecord,
} from "@/modules/tasks";
import styles from "./project-members-dialog.module.css";

export function ProjectMembersDialog({
  project,
  open,
  onClose,
  onUpdated,
}: {
  project: ProjectRecord | null;
  open: boolean;
  onClose: () => void;
  onUpdated: (project: ProjectRecord) => void;
}) {
  const { selectedWorkspace, profile } = useAuth();
  const { toast } = useToast();
  const workspaceId = selectedWorkspace?.id ?? null;

  const [members, setMembers] = useState<ProjectMemberSummary[]>([]);
  const [workspaceOptions, setWorkspaceOptions] = useState<
    { userId: string; fullName: string; roleKey: string }[]
  >([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId || !project) {
      return;
    }

    setLoading(true);
    setError(null);

    const [membersResult, workspaceResult] = await Promise.all([
      tasksService.listProjectMembers(workspaceId, project.id),
      listMembers(workspaceId),
    ]);

    setLoading(false);

    if (workspaceResult.success) {
      setWorkspaceOptions(
        workspaceResult.data
          .filter((member) => member.status === "ACTIVE")
          .map((member) => ({
            userId: member.user.id,
            fullName: member.user.fullName,
            roleKey: member.role.key,
          })),
      );
    }

    if (membersResult.ok) {
      setMembers(membersResult.data);
      setSelectedIds(membersResult.data.map((member) => member.userId));
      return;
    }

    // Fall back to list payload when dedicated members route is unavailable.
    if (project.members.length > 0 || project.memberIds.length > 0) {
      const fallback =
        project.members.length > 0
          ? project.members
          : project.memberIds.map((userId) => ({
              id: userId,
              userId,
              fullName:
                workspaceResult.success
                  ? (workspaceResult.data.find((m) => m.user.id === userId)
                      ?.user.fullName ?? userId)
                  : userId,
              email: null,
              roleKey:
                workspaceResult.success
                  ? (workspaceResult.data.find((m) => m.user.id === userId)
                      ?.role.key ?? null)
                  : null,
              status: "ACTIVE",
            }));
      setMembers(fallback);
      setSelectedIds(fallback.map((member) => member.userId));
      setError(null);
      return;
    }

    setError(membersResult.message);
  }, [workspaceId, project]);

  useEffect(() => {
    if (open && project) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- load members when dialog opens
      void load();
    }
  }, [open, project, load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return workspaceOptions;
    }

    return workspaceOptions.filter((member) => {
      const haystack = `${member.fullName} ${member.roleKey}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [workspaceOptions, query]);

  function toggle(userId: string) {
    if (userId === profile?.id || userId === project?.createdById) {
      return;
    }

    setSelectedIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  }

  async function handleSave() {
    if (!workspaceId || !project || saving) {
      return;
    }

    setSaving(true);
    const result = await tasksService.updateProject(workspaceId, project.id, {
      visibility: "PRIVATE",
      memberIds: selectedIds,
    });
    setSaving(false);

    if (!result.ok) {
      toast({
        title: "Couldn't update members",
        description: result.message,
        tone: "error",
      });
      return;
    }

    const nextMembers =
      result.data.members.length > 0
        ? result.data.members
        : projectMembersToCandidates(
            members.filter((member) => selectedIds.includes(member.userId)),
          ).map((candidate) => ({
            id: candidate.id,
            userId: candidate.id,
            fullName: candidate.name,
            email: null,
            roleKey: candidate.role ?? null,
            status: "ACTIVE",
          }));

    const updated: ProjectRecord = {
      ...project,
      ...result.data,
      name: result.data.name || project.name,
      memberIds:
        result.data.memberIds.length > 0
          ? result.data.memberIds
          : selectedIds,
      members: nextMembers.length > 0 ? nextMembers : result.data.members,
    };

    onUpdated(updated);
    toast({
      title: "Members updated",
      description: `Membership for "${project.name}" was saved.`,
      tone: "success",
    });
    onClose();
  }

  return (
    <Dialog
      open={open && Boolean(project)}
      onClose={onClose}
      title={project ? `Members · ${project.name}` : "Project members"}
      description="Private project membership is limited to ACTIVE workspace members. The creator cannot be removed."
      size="lg"
    >
      {loading ? (
        <LoadingState label="Loading members..." />
      ) : error ? (
        <ErrorState
          title="Couldn't load members"
          description={error}
          onRetry={() => void load()}
        />
      ) : (
        <div className={styles.stack}>
          <TextInput
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search ACTIVE workspace members…"
            aria-label="Search members"
          />

          {members.length > 0 && (
            <div className={styles.current}>
              <p className={styles.sectionLabel}>Current members</p>
              <ul className={styles.avatarList}>
                {members.map((member) => (
                  <li key={member.userId} className={styles.avatarItem}>
                    <span className={styles.avatar} aria-hidden>
                      {initialsFromName(member.fullName ?? member.email ?? member.userId)}
                    </span>
                    <span>
                      <span className={styles.memberName}>{member.fullName}</span>
                      {member.roleKey && (
                        <span className={styles.memberRole}>
                          {" "}
                          · {member.roleKey}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className={styles.sectionLabel}>Update membership</p>
          {filtered.length === 0 ? (
            <EmptyState
              title="No members found"
              description="Invite ACTIVE workspace members before adding them here."
            />
          ) : (
            <ul className={styles.checklist}>
              {filtered.map((member) => {
                const locked =
                  member.userId === profile?.id ||
                  member.userId === project?.createdById;
                return (
                  <li key={member.userId}>
                    <Checkbox
                      label={`${member.fullName} · ${member.roleKey}${locked ? " (required)" : ""}`}
                      checked={selectedIds.includes(member.userId)}
                      disabled={locked}
                      onChange={() => toggle(member.userId)}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          <div className={styles.actions}>
            <Button loading={saving} onClick={() => void handleSave()}>
              Save members
            </Button>
            <Button variant="secondary" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

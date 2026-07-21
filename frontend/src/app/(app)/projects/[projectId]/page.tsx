"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { hasPermission, useAuth } from "@/modules/auth";
import {
  Badge,
  Button,
  ErrorState,
  LoadingState,
  Select,
  TextArea,
  TextInput,
  useToast,
} from "@/modules/design-system";
import { dashboardService } from "@/modules/dashboard";
import {
  projectHealthTone,
  projectStatusLabel,
  projectsService,
  type ProjectRecord,
  type ProjectRole,
  type ProjectStatus,
} from "@/modules/projects";
import { PageHeader } from "@/modules/shell";
import { ProjectWorkflowPanel } from "@/modules/workflows";
import { formatAbsoluteDateTime } from "@/modules/tasks";
import { listMembers } from "@/modules/workspaces/members.service";
import styles from "../../app-pages.module.css";
import pageStyles from "../projects.module.css";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "tasks", label: "Tasks" },
  { id: "workflow", label: "Workflow" },
  { id: "members", label: "Members" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const { selectedWorkspace, permissions } = useAuth();
  const { toast } = useToast();
  const workspaceId = selectedWorkspace?.id ?? null;
  const projectId = params.projectId;
  const tab = (searchParams.get("tab") as TabId | null) ?? "overview";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [workspaceMembers, setWorkspaceMembers] = useState<
    Array<{ id: string; fullName: string | null; email: string | null }>
  >([]);
  const [memberToAdd, setMemberToAdd] = useState("");
  const [memberRoleToAdd, setMemberRoleToAdd] = useState<ProjectRole>("PROJECT_MEMBER");
  const [activity, setActivity] = useState<
    Array<{ id: string; summary: string; actorName: string | null; createdAt: string | null }>
  >([]);
  const [settingsDraft, setSettingsDraft] = useState({
    name: "",
    code: "",
    description: "",
    priority: "MEDIUM",
    managerId: "",
    startAt: "",
    endAt: "",
    completionPolicy: "WARN_ONLY",
  });

  const canUpdate = hasPermission(permissions, "projects:update");
  const canDelete = hasPermission(permissions, "projects:delete");

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    const result = await projectsService.getProject(workspaceId, projectId);
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setProject(result.data);
    setSettingsDraft({
      name: result.data.name,
      code: result.data.code ?? "",
      description: result.data.description ?? "",
      priority: String(result.data.priority ?? "MEDIUM"),
      managerId: result.data.managerId ?? "",
      startAt: result.data.startAt?.slice(0, 10) ?? "",
      endAt: result.data.endAt?.slice(0, 10) ?? "",
      completionPolicy: String(result.data.completionPolicy ?? "WARN_ONLY"),
    });
  }, [workspaceId, projectId]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  useEffect(() => {
    if (!workspaceId) return;
    void listMembers(workspaceId).then((result) => {
      if (!result.success) return;
      setWorkspaceMembers(
        (result.data ?? []).map((member) => ({
          id: member.user.id,
          fullName: member.user.fullName ?? null,
          email: member.user.email ?? null,
        })),
      );
    });
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId || !project || tab !== "activity") return;
    void dashboardService
      .getActivity(
        workspaceId,
        { from: null, to: null, projectId: project.id, memberId: null, status: null },
        { limit: 20, page: 1 },
      )
      .then((result) => {
        if (!result.ok) return;
        setActivity(result.data.items);
      });
  }, [workspaceId, project, tab]);

  const visibleTabs = useMemo(() => {
    return TABS.filter((item) => {
      if (item.id === "activity") {
        return hasPermission(permissions, "activity:read");
      }
      return true;
    });
  }, [permissions]);

  async function changeStatus(nextStatus: ProjectStatus) {
    if (!workspaceId || !project) return;
    setBusy(true);
    const result = await projectsService.updateProject(workspaceId, project.id, {
      status: nextStatus,
      completionOverrideReason:
        nextStatus === "COMPLETED" && overrideReason.trim()
          ? overrideReason.trim()
          : undefined,
    });
    setBusy(false);
    if (!result.ok) {
      toast({ title: "Status update failed", description: result.message, tone: "error" });
      return;
    }
    setProject(result.data);
    toast({ title: "Project status updated", tone: "success" });
  }

  async function archiveProject() {
    if (!workspaceId || !project) return;
    setBusy(true);
    const result = await projectsService.archiveProject(workspaceId, project.id);
    setBusy(false);
    if (!result.ok) {
      toast({ title: "Archive failed", description: result.message, tone: "error" });
      return;
    }
    setProject(result.data);
  }

  async function saveSettings() {
    if (!workspaceId || !project) return;
    setBusy(true);
    const result = await projectsService.updateProject(workspaceId, project.id, {
      name: settingsDraft.name.trim(),
      code: settingsDraft.code.trim() ? settingsDraft.code.trim() : null,
      description: settingsDraft.description.trim()
        ? settingsDraft.description.trim()
        : null,
      priority: settingsDraft.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
      managerId: settingsDraft.managerId || null,
      startAt: settingsDraft.startAt ? `${settingsDraft.startAt}T00:00:00.000Z` : null,
      endAt: settingsDraft.endAt ? `${settingsDraft.endAt}T23:59:59.999Z` : null,
      completionPolicy: settingsDraft.completionPolicy as
        | "WARN_ONLY"
        | "BLOCK"
        | "BLOCK_WITH_OVERRIDE",
    });
    setBusy(false);
    if (!result.ok) {
      toast({ title: "Update failed", description: result.message, tone: "error" });
      return;
    }
    setProject(result.data);
    toast({ title: "Project settings saved", tone: "success" });
  }

  async function addMember() {
    if (!workspaceId || !project || !memberToAdd) return;
    setBusy(true);
    const result = await projectsService.addProjectMember(workspaceId, project.id, {
      userId: memberToAdd,
      projectRole: memberRoleToAdd,
    });
    setBusy(false);
    if (!result.ok) {
      toast({ title: "Add member failed", description: result.message, tone: "error" });
      return;
    }
    setProject(result.data);
    setMemberToAdd("");
  }

  async function updateMemberRole(userId: string, role: ProjectRole) {
    if (!workspaceId || !project) return;
    setBusy(true);
    const result = await projectsService.updateProjectMemberRole(
      workspaceId,
      project.id,
      userId,
      role,
    );
    setBusy(false);
    if (!result.ok) {
      toast({ title: "Role update failed", description: result.message, tone: "error" });
      return;
    }
    setProject(result.data);
  }

  async function removeMember(userId: string) {
    if (!workspaceId || !project) return;
    setBusy(true);
    const result = await projectsService.removeProjectMember(workspaceId, project.id, userId);
    setBusy(false);
    if (!result.ok) {
      toast({ title: "Remove member failed", description: result.message, tone: "error" });
      return;
    }
    setProject(result.data);
  }

  if (loading) return <LoadingState label="Loading project..." />;
  if (error || !project) {
    return (
      <ErrorState
        title="Couldn't load project"
        description={error ?? "Project not found"}
        onRetry={() => void load()}
      />
    );
  }

  return (
    <div className={styles.stack}>
      <PageHeader
        title={project.name}
        description={project.code ? `Code: ${project.code}` : undefined}
        actions={
          canUpdate ? (
            <Select
              aria-label="Project status"
              value={project.status}
              disabled={busy}
              onChange={(event) =>
                void changeStatus(event.target.value as ProjectStatus)
              }
            >
              {(
                [
                  "PLANNING",
                  "ACTIVE",
                  "ON_HOLD",
                  "COMPLETED",
                  "CANCELLED",
                  "ARCHIVED",
                ] as ProjectStatus[]
              ).map((status) => (
                <option key={status} value={status}>
                  {projectStatusLabel(status)}
                </option>
              ))}
            </Select>
          ) : undefined
        }
      />

      <section className={styles.card}>
        <div className={pageStyles.detailHeader}>
          <div className={pageStyles.badgeRow}>
            <Badge tone="neutral">{projectStatusLabel(project.status)}</Badge>
            {project.health && (
              <Badge tone={projectHealthTone(project.health)}>{project.health}</Badge>
            )}
            {project.visibility === "PRIVATE" && <Badge tone="warning">Private</Badge>}
          </div>
          <div className={pageStyles.detailMeta}>
            {project.manager?.fullName && <span>Manager: {project.manager.fullName}</span>}
            {project.startAt && <span>Start: {project.startAt.slice(0, 10)}</span>}
            {project.endAt && <span>End: {project.endAt.slice(0, 10)}</span>}
            {project.progressPercent !== null && (
              <span>Progress: {project.progressPercent}%</span>
            )}
            {project.overdueTasks !== null && (
              <span>Overdue tasks: {project.overdueTasks}</span>
            )}
          </div>
        </div>

        <nav className={pageStyles.tabRow} aria-label="Project sections">
          {visibleTabs.map((item) => (
            <Link
              key={item.id}
              href={`/projects/${project.id}?tab=${item.id}`}
              className={`${pageStyles.tabLink} ${tab === item.id ? pageStyles.tabLinkActive : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {tab === "overview" && (
          <div className={styles.stack}>
            {project.description && <p>{project.description}</p>}
            <p className={styles.muted}>
              {project.openTasks ?? 0} open · {project.totalTasks ?? 0} total tasks
            </p>
            <Link href={`/my-tasks?projectId=${encodeURIComponent(project.id)}`}>
              Open tasks board
            </Link>
          </div>
        )}

        {tab === "tasks" && (
          <Link href={`/my-tasks?projectId=${encodeURIComponent(project.id)}`}>
            View all tasks for this project
          </Link>
        )}

        {tab === "workflow" && workspaceId ? (
          <ProjectWorkflowPanel
            workspaceId={workspaceId}
            projectId={project.id}
            canEdit={canUpdate}
          />
        ) : null}

        {tab === "members" && (
          <div className={styles.stack}>
            <div className={pageStyles.toolbar}>
              <Select
                aria-label="Add workspace member"
                value={memberToAdd}
                onChange={(event) => setMemberToAdd(event.target.value)}
              >
                <option value="">Select member</option>
                {workspaceMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName ?? member.email ?? member.id}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="New member role"
                value={memberRoleToAdd}
                onChange={(event) => setMemberRoleToAdd(event.target.value as ProjectRole)}
              >
                <option value="PROJECT_MEMBER">Member</option>
                <option value="PROJECT_VIEWER">Viewer</option>
                <option value="PROJECT_MANAGER">Manager</option>
              </Select>
              <Button disabled={busy || !memberToAdd} onClick={() => void addMember()}>
                Add member
              </Button>
            </div>
            <ul>
              {project.members.map((member) => (
                <li key={member.userId} className={pageStyles.listRow}>
                  <span>{member.fullName ?? member.email ?? member.userId}</span>
                  <div className={pageStyles.toolbar}>
                    <Select
                      aria-label={`Role for ${member.userId}`}
                      value={member.projectRole}
                      onChange={(event) =>
                        void updateMemberRole(
                          member.userId,
                          event.target.value as ProjectRole,
                        )
                      }
                    >
                      <option value="PROJECT_OWNER">Owner</option>
                      <option value="PROJECT_MANAGER">Manager</option>
                      <option value="PROJECT_MEMBER">Member</option>
                      <option value="PROJECT_VIEWER">Viewer</option>
                    </Select>
                    <Button
                      variant="dangerOutline"
                      disabled={busy}
                      onClick={() => void removeMember(member.userId)}
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "activity" && (
          <ul className={styles.stack}>
            {activity.length === 0 ? (
              <p className={styles.muted}>No activity yet.</p>
            ) : (
              activity.map((event) => (
                <li key={event.id}>
                  {event.summary} · {event.actorName ?? "System"} ·{" "}
                  {formatAbsoluteDateTime(event.createdAt)}
                </li>
              ))
            )}
          </ul>
        )}

        {tab === "settings" && (
          <div className={styles.stack}>
            <div className={pageStyles.formGrid}>
              <TextInput
                aria-label="Project name"
                value={settingsDraft.name}
                onChange={(event) =>
                  setSettingsDraft((prev) => ({ ...prev, name: event.target.value }))
                }
              />
              <TextInput
                aria-label="Project code"
                value={settingsDraft.code}
                onChange={(event) =>
                  setSettingsDraft((prev) => ({ ...prev, code: event.target.value }))
                }
              />
              <Select
                aria-label="Priority"
                value={settingsDraft.priority}
                onChange={(event) =>
                  setSettingsDraft((prev) => ({ ...prev, priority: event.target.value }))
                }
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </Select>
              <Select
                aria-label="Project manager"
                value={settingsDraft.managerId}
                onChange={(event) =>
                  setSettingsDraft((prev) => ({ ...prev, managerId: event.target.value }))
                }
              >
                <option value="">No manager</option>
                {workspaceMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName ?? member.email ?? member.id}
                  </option>
                ))}
              </Select>
              <TextInput
                aria-label="Start date"
                type="date"
                value={settingsDraft.startAt}
                onChange={(event) =>
                  setSettingsDraft((prev) => ({ ...prev, startAt: event.target.value }))
                }
              />
              <TextInput
                aria-label="End date"
                type="date"
                value={settingsDraft.endAt}
                onChange={(event) =>
                  setSettingsDraft((prev) => ({ ...prev, endAt: event.target.value }))
                }
              />
              <Select
                aria-label="Completion policy"
                value={settingsDraft.completionPolicy}
                onChange={(event) =>
                  setSettingsDraft((prev) => ({
                    ...prev,
                    completionPolicy: event.target.value,
                  }))
                }
              >
                <option value="WARN_ONLY">Warn only</option>
                <option value="BLOCK">Block completion</option>
                <option value="BLOCK_WITH_OVERRIDE">Block with override</option>
              </Select>
            </div>
            <TextArea
              aria-label="Project description"
              value={settingsDraft.description}
              onChange={(event) =>
                setSettingsDraft((prev) => ({ ...prev, description: event.target.value }))
              }
            />
            <TextInput
              aria-label="Completion override reason"
              placeholder="Completion override reason (optional)"
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
            />
            <p>Completion policy: {project.completionPolicy}</p>
            {canUpdate && (
              <Button disabled={busy} onClick={() => void saveSettings()}>
                Save settings
              </Button>
            )}
            {canUpdate && project.status !== "ARCHIVED" && (
              <Button disabled={busy} variant="secondary" onClick={() => void archiveProject()}>
                Archive project
              </Button>
            )}
            {canDelete && (
              <Button
                disabled={busy}
                variant="dangerOutline"
                onClick={() =>
                  void projectsService
                    .deleteProject(workspaceId!, project.id)
                    .then((result) => {
                      if (!result.ok) {
                        toast({
                          title: "Delete failed",
                          description: result.message,
                          tone: "error",
                        });
                        return;
                      }
                      toast({ title: "Project deleted", tone: "success" });
                    })
                }
              >
                Move to trash
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

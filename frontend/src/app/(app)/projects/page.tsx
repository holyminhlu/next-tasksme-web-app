"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderKanban, LayoutGrid, List, Plus } from "lucide-react";
import { hasPermission, useAuth } from "@/modules/auth";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  Pagination,
  Select,
  TextInput,
} from "@/modules/design-system";
import {
  canManageProjectMembers,
  projectHealthTone,
  projectStatusLabel,
  projectsService,
  type ProjectRecord,
  type ProjectStatus,
} from "@/modules/projects";
import { listMembers } from "@/modules/workspaces/members.service";
import { PageHeader, useShell } from "@/modules/shell";
import styles from "../app-pages.module.css";
import pageStyles from "./projects.module.css";

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "PLANNING", label: "Planning" },
  { value: "ACTIVE", label: "Active" },
  { value: "ON_HOLD", label: "On hold" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function ProjectsPage() {
  const { profile, selectedWorkspace, permissions } = useAuth();
  const { navContext } = useShell();
  const workspaceId = selectedWorkspace?.id ?? null;
  const canRead = hasPermission(permissions, "projects:read");
  const canCreate = hasPermission(permissions, "projects:create");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<
    Array<{ id: string; fullName: string | null; email: string | null }>
  >([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [viewScope, setViewScope] = useState<"active" | "archived" | "trash">("active");
  const [managerId, setManagerId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [startFrom, setStartFrom] = useState("");
  const [endTo, setEndTo] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const load = useCallback(async () => {
    if (!workspaceId || !canRead) return;
    setLoading(true);
    setError(null);
    const result = await projectsService.listProjects(workspaceId, {
      search: search.trim() || undefined,
      status: (status || undefined) as ProjectStatus | undefined,
      managerId: managerId || undefined,
      memberId: memberId || undefined,
      startFrom: startFrom ? `${startFrom}T00:00:00.000Z` : undefined,
      endTo: endTo ? `${endTo}T23:59:59.999Z` : undefined,
      includeArchived: viewScope === "active" ? false : true,
      archivedOnly: viewScope === "archived",
      includeDeleted: viewScope === "trash",
      deletedOnly: viewScope === "trash",
      page,
      pageSize,
      sortBy: "updatedAt",
      sortOrder: "desc",
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setProjects(result.data.items);
    setTotal(result.data.total);
  }, [
    workspaceId,
    canRead,
    search,
    status,
    managerId,
    memberId,
    startFrom,
    endTo,
    viewScope,
    page,
  ]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  useEffect(() => {
    if (!workspaceId) return;
    void listMembers(workspaceId).then((result) => {
      if (!result.success) return;
      const mapped = (result.data ?? []).map((member) => ({
        id: member.user.id,
        fullName: member.user.fullName ?? null,
        email: member.user.email ?? null,
      }));
      setWorkspaceMembers(mapped);
    });
  }, [workspaceId]);

  useEffect(() => {
    const id = window.setTimeout(() => setPage(1), 0);
    return () => window.clearTimeout(id);
  }, [search, status, managerId, memberId, startFrom, endTo, viewScope]);

  const modulesKnown = navContext.enabledModuleKeys !== null;
  const projectsModuleDisabled =
    modulesKnown && !navContext.enabledModuleKeys!.includes("projects");

  const summary = useMemo(
    () => `${total} project${total === 1 ? "" : "s"}`,
    [total],
  );
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  if (!canRead) {
    return (
      <div className={styles.stack}>
        <PageHeader title="Projects" />
        <ForbiddenState />
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      <PageHeader
        title="Projects"
        description="Manage project lifecycle, membership, and delivery health."
        actions={
          canCreate && !projectsModuleDisabled ? (
            <Link href="/projects/new">
              <Button iconLeft={<Plus size={16} aria-hidden />}>New project</Button>
            </Link>
          ) : undefined
        }
      />

      {projectsModuleDisabled ? (
        <EmptyState
          title="Projects module is disabled"
          description="An admin can re-enable it under Settings → Modules."
        />
      ) : (
        <>
          <div className={pageStyles.toolbar}>
            <TextInput
              aria-label="Search projects"
              placeholder="Search name or code"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select
              aria-label="Filter by status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Button
              variant={viewScope === "active" ? "primary" : "secondary"}
              onClick={() => setViewScope("active")}
            >
              Active
            </Button>
            <Button
              variant={viewScope === "archived" ? "primary" : "secondary"}
              onClick={() => setViewScope("archived")}
            >
              Archived
            </Button>
            <Button
              variant={viewScope === "trash" ? "primary" : "secondary"}
              onClick={() => setViewScope("trash")}
            >
              Trash
            </Button>
            <Select
              aria-label="Filter by manager"
              value={managerId}
              onChange={(event) => setManagerId(event.target.value)}
            >
              <option value="">All managers</option>
              {workspaceMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName ?? member.email ?? member.id}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filter by member"
              value={memberId}
              onChange={(event) => setMemberId(event.target.value)}
            >
              <option value="">All members</option>
              {workspaceMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName ?? member.email ?? member.id}
                </option>
              ))}
            </Select>
            <TextInput
              aria-label="Start date from"
              type="date"
              value={startFrom}
              onChange={(event) => setStartFrom(event.target.value)}
            />
            <TextInput
              aria-label="End date to"
              type="date"
              value={endTo}
              onChange={(event) => setEndTo(event.target.value)}
            />
            <div className={pageStyles.viewToggle}>
              <Button
                size="sm"
                variant={viewMode === "grid" ? "primary" : "ghost"}
                iconLeft={<LayoutGrid size={14} aria-hidden />}
                onClick={() => setViewMode("grid")}
              >
                Grid
              </Button>
              <Button
                size="sm"
                variant={viewMode === "list" ? "primary" : "ghost"}
                iconLeft={<List size={14} aria-hidden />}
                onClick={() => setViewMode("list")}
              >
                List
              </Button>
            </div>
          </div>

          {loading ? (
            <LoadingState label="Loading projects..." />
          ) : error ? (
            <ErrorState
              title="Couldn't load projects"
              description={error}
              onRetry={() => void load()}
            />
          ) : projects.length === 0 ? (
            <EmptyState
              icon={<FolderKanban size={22} />}
              title="No projects found"
              description="Try adjusting filters or create a new project."
              actions={
                canCreate ? (
                  <Link href="/projects/new">
                    <Button>New project</Button>
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <>
              <p className={pageStyles.resultsSummary}>{summary}</p>
              <div
                className={
                  viewMode === "grid" ? pageStyles.grid : pageStyles.listTable
                }
              >
                {projects.map((project) => {
                  const canManage = canManageProjectMembers({
                    roleKey: selectedWorkspace?.roleKey,
                    project,
                    userId: profile?.id,
                  });
                  return (
                    <article
                      key={project.id}
                      className={
                        viewMode === "grid"
                          ? pageStyles.projectCard
                          : pageStyles.listRow
                      }
                    >
                      <div className={pageStyles.projectHeader}>
                        <div>
                          <Link
                            href={`/projects/${project.id}`}
                            className={pageStyles.projectNameLink}
                          >
                            {project.name}
                          </Link>
                          {project.code && (
                            <p className={pageStyles.projectCode}>{project.code}</p>
                          )}
                        </div>
                        <div className={pageStyles.badgeRow}>
                          <Badge tone="neutral">
                            {projectStatusLabel(project.status)}
                          </Badge>
                          {project.health && (
                            <Badge tone={projectHealthTone(project.health)}>
                              {project.health.replace("_", " ")}
                            </Badge>
                          )}
                          {project.visibility === "PRIVATE" && (
                            <Badge tone="warning">Private</Badge>
                          )}
                        </div>
                      </div>
                      <div className={pageStyles.projectMeta}>
                        {project.manager?.fullName && (
                          <span>PM: {project.manager.fullName}</span>
                        )}
                        {project.progressPercent !== null && (
                          <span>{project.progressPercent}% complete</span>
                        )}
                        {project.overdueTasks !== null && project.overdueTasks > 0 && (
                          <span>{project.overdueTasks} overdue</span>
                        )}
                        {project.openTasks !== null && (
                          <span>{project.openTasks} open tasks</span>
                        )}
                      </div>
                      <div className={pageStyles.projectFooter}>
                        <Link
                          className={pageStyles.projectLink}
                          href={`/my-tasks?projectId=${encodeURIComponent(project.id)}`}
                        >
                          View tasks
                        </Link>
                        {canManage && (
                          <Link
                            className={pageStyles.projectLink}
                            href={`/projects/${project.id}?tab=settings`}
                          >
                            Settings
                          </Link>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
              <Pagination
                page={page}
                pageCount={pageCount}
                onPageChange={setPage}
                aria-label="Project list pagination"
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

import {
  asNonEmptyString,
  asNumber,
  asRecord,
  pick,
} from "@/lib/api/coerce";
import type {
  ProjectListResult,
  ProjectMemberRecord,
  ProjectRecord,
  ProjectRole,
} from "./projects.types";

function mapMember(raw: unknown): ProjectMemberRecord | null {
  const record = asRecord(raw);
  if (!record) return null;
  const userId =
    pick(record, ["userId", "id"], asNonEmptyString) ??
    pick(record, ["userId"], asNonEmptyString);
  if (!userId) return null;
  return {
    userId,
    projectRole:
      (pick(record, ["projectRole"], asNonEmptyString) as ProjectRole | null) ??
      "PROJECT_MEMBER",
    joinedAt: pick(record, ["joinedAt"], asNonEmptyString),
    id: pick(record, ["id"], asNonEmptyString) ?? userId,
    fullName: pick(record, ["fullName", "name"], asNonEmptyString),
    email: pick(record, ["email"], asNonEmptyString),
    roleKey: pick(record, ["role", "roleKey"], asNonEmptyString),
    status: pick(record, ["status"], asNonEmptyString),
  };
}

export function mapProject(raw: unknown): ProjectRecord | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = pick(record, ["id", "projectId"], asNonEmptyString);
  const name = pick(record, ["name", "projectName"], asNonEmptyString);
  if (!id || !name) return null;

  const managerRecord = asRecord(record.manager);
  const membersRaw = record.members ?? record.memberSummaries ?? [];
  const members = (Array.isArray(membersRaw) ? membersRaw : [])
    .map(mapMember)
    .filter((item): item is ProjectMemberRecord => item !== null);
  const memberIdsFromField = Array.isArray(record.memberIds)
    ? record.memberIds.filter((value): value is string => typeof value === "string")
    : [];
  const memberIds =
    memberIdsFromField.length > 0 ? memberIdsFromField : members.map((m) => m.userId);

  return {
    id,
    workspaceId: pick(record, ["workspaceId"], asNonEmptyString),
    name,
    code: pick(record, ["code"], asNonEmptyString),
    description: pick(record, ["description"], asNonEmptyString),
    status: pick(record, ["status"], asNonEmptyString) ?? "ACTIVE",
    priority: pick(record, ["priority"], asNonEmptyString) ?? "MEDIUM",
    visibility:
      pick(record, ["visibility"], asNonEmptyString) === "PRIVATE"
        ? "PRIVATE"
        : pick(record, ["visibility"], asNonEmptyString) === "WORKSPACE"
          ? "WORKSPACE"
          : null,
    managerId: pick(record, ["managerId"], asNonEmptyString),
    manager: managerRecord
      ? {
          id: pick(managerRecord, ["id"], asNonEmptyString) ?? "",
          fullName: pick(managerRecord, ["fullName"], asNonEmptyString),
          email: pick(managerRecord, ["email"], asNonEmptyString),
        }
      : null,
    startAt: pick(record, ["startAt"], asNonEmptyString),
    endAt: pick(record, ["endAt"], asNonEmptyString),
    completionPolicy:
      pick(record, ["completionPolicy"], asNonEmptyString) ?? "WARN_ONLY",
    completedAt: pick(record, ["completedAt"], asNonEmptyString),
    archivedAt: pick(record, ["archivedAt"], asNonEmptyString),
    deletedAt: pick(record, ["deletedAt"], asNonEmptyString),
    createdById: pick(record, ["createdById", "creatorId"], asNonEmptyString),
    memberIds,
    members,
    openTasks: pick(record, ["openTasks", "openTaskCount"], asNumber),
    totalTasks: pick(record, ["totalTasks", "taskCount"], asNumber),
    overdueTasks: pick(record, ["overdueTasks"], asNumber),
    progressPercent: pick(record, ["progressPercent"], asNumber),
    health: pick(record, ["health"], asNonEmptyString),
    createdAt: pick(record, ["createdAt"], asNonEmptyString),
    updatedAt: pick(record, ["updatedAt"], asNonEmptyString),
  };
}

export function mapProjectList(data: unknown, meta?: unknown): ProjectListResult {
  const record = asRecord(data);
  const metaRecord = asRecord(meta);
  const pagination =
    asRecord(metaRecord?.pagination) ?? asRecord(record?.pagination);
  const rawItems = Array.isArray(data)
    ? data
    : (record?.items ?? record?.projects ?? record?.data);
  const items = (Array.isArray(rawItems) ? rawItems : [])
    .map(mapProject)
    .filter((item): item is ProjectRecord => item !== null);
  return {
    items,
    total: pick(pagination, ["total"], asNumber) ?? items.length,
    page: pick(pagination, ["page"], asNumber) ?? 1,
    pageSize: pick(pagination, ["pageSize"], asNumber) ?? items.length,
  };
}

export function canManageProjectMembers(options: {
  roleKey: string | null | undefined;
  project: Pick<ProjectRecord, "visibility" | "createdById" | "members">;
  userId: string | null | undefined;
}): boolean {
  if (options.roleKey === "owner" || options.roleKey === "admin") return true;
  const membership = options.project.members.find(
    (member) => member.userId === options.userId,
  );
  if (
    membership &&
    (membership.projectRole === "PROJECT_OWNER" ||
      membership.projectRole === "PROJECT_MANAGER")
  ) {
    return true;
  }
  return (
    options.project.createdById != null &&
    options.project.createdById === options.userId
  );
}

export function projectStatusLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function projectHealthTone(
  health: string | null | undefined,
): "success" | "warning" | "danger" | "neutral" {
  if (health === "GOOD") return "success";
  if (health === "AT_RISK") return "warning";
  if (health === "CRITICAL") return "danger";
  return "neutral";
}

import type { ProjectRole, ProjectVisibility } from "../../generated/prisma/client.js";
import { ForbiddenError } from "./errors.js";

export type ProjectAccessActor = {
  userId: string;
  roleKey: string;
};

export type ProjectAccessContext = {
  visibility: ProjectVisibility;
  createdById: string | null;
  members: Array<{ userId: string; projectRole: ProjectRole }>;
};

const MANAGE_ROLES: ProjectRole[] = ["PROJECT_OWNER", "PROJECT_MANAGER"];
const SETTINGS_ROLES: ProjectRole[] = ["PROJECT_OWNER", "PROJECT_MANAGER"];

export function isWorkspaceAdmin(actor: ProjectAccessActor): boolean {
  return actor.roleKey === "owner" || actor.roleKey === "admin";
}

export function projectRoleFor(
  actor: ProjectAccessActor,
  project: ProjectAccessContext,
): ProjectRole | null {
  if (isWorkspaceAdmin(actor)) return "PROJECT_OWNER";
  const membership = project.members.find((member) => member.userId === actor.userId);
  return membership?.projectRole ?? null;
}

export function canViewProject(actor: ProjectAccessActor, project: ProjectAccessContext): boolean {
  if (isWorkspaceAdmin(actor)) return true;
  if (project.visibility === "WORKSPACE") return true;
  return project.members.some((member) => member.userId === actor.userId);
}

export function canManageProject(actor: ProjectAccessActor, project: ProjectAccessContext): boolean {
  if (isWorkspaceAdmin(actor)) return true;
  const role = projectRoleFor(actor, project);
  return role !== null && MANAGE_ROLES.includes(role);
}

export function canManageProjectSettings(
  actor: ProjectAccessActor,
  project: ProjectAccessContext,
): boolean {
  if (isWorkspaceAdmin(actor)) return true;
  const role = projectRoleFor(actor, project);
  return role !== null && SETTINGS_ROLES.includes(role);
}

export function assertCanViewProject(actor: ProjectAccessActor, project: ProjectAccessContext): void {
  if (!canViewProject(actor, project)) {
    throw new ForbiddenError("You do not have access to this project");
  }
}

export function assertCanManageProject(
  actor: ProjectAccessActor,
  project: ProjectAccessContext,
): void {
  if (!canManageProject(actor, project)) {
    throw new ForbiddenError("You do not have permission to manage this project");
  }
}

export function assertCanManageProjectSettings(
  actor: ProjectAccessActor,
  project: ProjectAccessContext,
): void {
  if (!canManageProjectSettings(actor, project)) {
    throw new ForbiddenError("You do not have permission to change project settings");
  }
}

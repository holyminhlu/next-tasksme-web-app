import type { PermissionKey } from "./auth.types";

const COLLAB_FULL: PermissionKey[] = [
  "checklist.manage",
  "tag.view",
  "tag.create",
  "tag.update",
  "tag.delete",
  "task.tag.manage",
  "custom_field.view",
  "custom_field.configure",
  "custom_field.value.update",
  "comment.view",
  "comment.create",
  "comment.update_own",
  "comment.delete_own",
  "comment.moderate",
  "attachment.view",
  "attachment.upload",
  "attachment.delete_own",
  "attachment.manage",
];

const COLLAB_MEMBER: PermissionKey[] = [
  "checklist.manage",
  "tag.view",
  "tag.create",
  "tag.update",
  "task.tag.manage",
  "custom_field.view",
  "custom_field.value.update",
  "comment.view",
  "comment.create",
  "comment.update_own",
  "comment.delete_own",
  "attachment.view",
  "attachment.upload",
  "attachment.delete_own",
];

const PHASE_72_FULL: PermissionKey[] = [
  "task_dependency.view",
  "task_dependency.manage",
  "task_dependency.override",
  "time_log.view_own",
  "time_log.create",
  "time_log.update_own",
  "time_log.delete_own",
  "time_log.view_all",
  "time_log.manage_all",
  "task_history.view",
];

const PHASE_72_MEMBER: PermissionKey[] = [
  "task_dependency.view",
  "task_dependency.manage",
  "time_log.view_own",
  "time_log.create",
  "time_log.update_own",
  "time_log.delete_own",
  "task_history.view",
];

const PHASE_73_FULL: PermissionKey[] = [
  "recurrence.view",
  "recurrence.manage",
  "risk.view",
  "risk.update",
  "risk.configure",
  "sla.view",
  "sla.configure",
  "sla.override",
  "automation.view",
  "automation.manage",
  "automation.retry",
];

const PHASE_73_MEMBER: PermissionKey[] = [
  "recurrence.view",
  "recurrence.manage",
  "risk.view",
  "risk.update",
  "sla.view",
  "automation.view",
];

// Mirrors backend ROLE_PERMISSION_MAP (backend/src/modules/auth/permissions.ts).
export const ROLE_PERMISSION_MAP: Record<string, PermissionKey[]> = {
  owner: [
    "workspace:read",
    "workspace:update",
    "members:read",
    "members:invite",
    "members:update",
    "members:remove",
    "ownership:transfer",
    "roles:read",
    "roles:manage",
    "modules:manage",
    "projects:read",
    "projects:create",
    "projects:update",
    "tasks:read",
    "tasks:create",
    "tasks:update",
    "tasks:assign",
    "tasks:delete",
    "projects:delete",
    "dashboard:read",
    "activity:read",
    ...COLLAB_FULL,
    ...PHASE_72_FULL,
    ...PHASE_73_FULL,
  ],
  admin: [
    "workspace:read",
    "workspace:update",
    "members:read",
    "members:invite",
    "members:update",
    "members:remove",
    "roles:read",
    "roles:manage",
    "modules:manage",
    "projects:read",
    "projects:create",
    "projects:update",
    "tasks:read",
    "tasks:create",
    "tasks:update",
    "tasks:assign",
    "tasks:delete",
    "projects:delete",
    "dashboard:read",
    "activity:read",
    ...COLLAB_FULL,
    ...PHASE_72_FULL,
    ...PHASE_73_FULL,
  ],
  manager: [
    "workspace:read",
    "members:read",
    "members:invite",
    "members:update",
    "roles:read",
    "projects:read",
    "projects:create",
    "projects:update",
    "tasks:read",
    "tasks:create",
    "tasks:update",
    "tasks:assign",
    "tasks:delete",
    "dashboard:read",
    "activity:read",
    ...COLLAB_FULL,
    ...PHASE_72_FULL,
    ...PHASE_73_FULL,
  ],
  member: [
    "workspace:read",
    "members:read",
    "roles:read",
    "projects:read",
    "tasks:read",
    "tasks:create",
    "tasks:update",
    "tasks:assign",
    "tasks:delete",
    "dashboard:read",
    "activity:read",
    ...COLLAB_MEMBER,
    ...PHASE_72_MEMBER,
    ...PHASE_73_MEMBER,
  ],
};

export function permissionsForRole(roleKey: string): PermissionKey[] {
  return ROLE_PERMISSION_MAP[roleKey] ?? [];
}

export function hasPermission(
  permissions: PermissionKey[],
  required: PermissionKey | PermissionKey[],
): boolean {
  const keys = Array.isArray(required) ? required : [required];
  return keys.every((key) => permissions.includes(key));
}

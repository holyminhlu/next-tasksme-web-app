import type { PermissionKey } from "./auth.types";

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
  ],
  member: [
    "workspace:read",
    "members:read",
    "roles:read",
    "projects:read",
    "tasks:read",
    "tasks:create",
    "tasks:update",
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

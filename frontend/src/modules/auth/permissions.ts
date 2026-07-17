import type { PermissionKey } from "./auth.types";

export const ROLE_PERMISSION_MAP: Record<string, PermissionKey[]> = {
  owner: [
    "company:read",
    "company:update",
    "members:read",
    "members:invite",
    "members:update",
    "members:remove",
    "ownership:transfer",
    "roles:read",
    "roles:manage",
  ],
  admin: [
    "company:read",
    "company:update",
    "members:read",
    "members:invite",
    "members:update",
    "members:remove",
    "roles:read",
    "roles:manage",
  ],
  manager: [
    "company:read",
    "members:read",
    "members:invite",
    "members:update",
    "roles:read",
  ],
  member: ["company:read", "members:read", "roles:read"],
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

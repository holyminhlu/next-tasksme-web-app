export const PERMISSIONS = [
  {
    key: "workspace:read",
    description: "View workspace profile",
  },
  {
    key: "workspace:update",
    description: "Update workspace profile",
  },
  {
    key: "members:read",
    description: "View workspace members",
  },
  {
    key: "members:invite",
    description: "Invite workspace members",
  },
  {
    key: "members:update",
    description: "Update workspace member roles",
  },
  {
    key: "members:remove",
    description: "Remove workspace members",
  },
  {
    key: "ownership:transfer",
    description: "Transfer workspace ownership",
  },
  {
    key: "roles:read",
    description: "View workspace roles",
  },
  {
    key: "roles:manage",
    description: "Manage workspace roles and permissions",
  },
  {
    key: "modules:manage",
    description: "Manage workspace modules",
  },
  {
    key: "projects:read",
    description: "View projects",
  },
  {
    key: "projects:create",
    description: "Create projects",
  },
  {
    key: "projects:update",
    description: "Update projects",
  },
  {
    key: "tasks:read",
    description: "View tasks",
  },
  {
    key: "tasks:create",
    description: "Create tasks",
  },
  {
    key: "tasks:update",
    description: "Update tasks",
  },
  {
    key: "tasks:delete",
    description: "Delete tasks",
  },
  {
    key: "tasks:assign",
    description: "Assign tasks to workspace members",
  },
  {
    key: "dashboard:read",
    description: "View workspace dashboard",
  },
  {
    key: "activity:read",
    description: "View workspace activity stream",
  },
  {
    key: "projects:delete",
    description: "Delete projects",
  },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const SYSTEM_ROLE_KEYS = ["owner", "admin", "manager", "member"] as const;

export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

export const ROLE_PERMISSION_MAP: Record<SystemRoleKey, PermissionKey[]> = {
  owner: PERMISSIONS.map((permission) => permission.key),
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
    "tasks:delete",
    "tasks:assign",
    "dashboard:read",
    "activity:read",
    "projects:delete",
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
    "tasks:delete",
    "tasks:assign",
    "dashboard:read",
    "activity:read",
  ],
  member: [
    "workspace:read",
    "members:read",
    "roles:read",
    "projects:read",
    "tasks:read",
    "tasks:create",
    "tasks:update",
    "tasks:delete",
    "tasks:assign",
    "dashboard:read",
    "activity:read",
  ],
};

export const INVITABLE_ROLE_KEYS: SystemRoleKey[] = ["admin", "manager", "member"];

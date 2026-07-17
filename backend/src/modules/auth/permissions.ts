export const PERMISSIONS = [
  {
    key: "company:read",
    description: "View company profile",
  },
  {
    key: "company:update",
    description: "Update company profile",
  },
  {
    key: "members:read",
    description: "View company members",
  },
  {
    key: "members:invite",
    description: "Invite company members",
  },
  {
    key: "members:update",
    description: "Update company member roles",
  },
  {
    key: "members:remove",
    description: "Remove company members",
  },
  {
    key: "ownership:transfer",
    description: "Transfer company ownership",
  },
  {
    key: "roles:read",
    description: "View company roles",
  },
  {
    key: "roles:manage",
    description: "Manage company roles and permissions",
  },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const SYSTEM_ROLE_KEYS = ["owner", "admin", "manager", "member"] as const;

export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

export const ROLE_PERMISSION_MAP: Record<SystemRoleKey, PermissionKey[]> = {
  owner: PERMISSIONS.map((permission) => permission.key),
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

export const INVITABLE_ROLE_KEYS: SystemRoleKey[] = [
  "admin",
  "manager",
  "member",
];

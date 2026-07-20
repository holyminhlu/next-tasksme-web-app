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
  {
    key: "checklist.manage",
    description: "Manage task checklist items",
  },
  {
    key: "tag.view",
    description: "View workspace tags",
  },
  {
    key: "tag.create",
    description: "Create workspace tags",
  },
  {
    key: "tag.update",
    description: "Update workspace tags",
  },
  {
    key: "tag.delete",
    description: "Delete workspace tags",
  },
  {
    key: "task.tag.manage",
    description: "Assign tags to tasks",
  },
  {
    key: "custom_field.view",
    description: "View custom field definitions and values",
  },
  {
    key: "custom_field.configure",
    description: "Configure custom field definitions",
  },
  {
    key: "custom_field.value.update",
    description: "Update custom field values on tasks",
  },
  {
    key: "comment.view",
    description: "View task comments",
  },
  {
    key: "comment.create",
    description: "Create task comments",
  },
  {
    key: "comment.update_own",
    description: "Update own task comments",
  },
  {
    key: "comment.delete_own",
    description: "Delete own task comments",
  },
  {
    key: "comment.moderate",
    description: "Moderate any task comments",
  },
  {
    key: "attachment.view",
    description: "View task attachments",
  },
  {
    key: "attachment.upload",
    description: "Upload task attachments",
  },
  {
    key: "attachment.delete_own",
    description: "Delete own task attachments",
  },
  {
    key: "attachment.manage",
    description: "Manage any task attachments",
  },
  {
    key: "task_dependency.view",
    description: "View task dependencies",
  },
  {
    key: "task_dependency.manage",
    description: "Manage task dependencies",
  },
  {
    key: "task_dependency.override",
    description: "Override dependency completion policy",
  },
  {
    key: "time_log.view_own",
    description: "View own time logs",
  },
  {
    key: "time_log.create",
    description: "Create and run own time logs",
  },
  {
    key: "time_log.update_own",
    description: "Update own time logs",
  },
  {
    key: "time_log.delete_own",
    description: "Delete own time logs",
  },
  {
    key: "time_log.view_all",
    description: "View all workspace time logs",
  },
  {
    key: "time_log.manage_all",
    description: "Manage all workspace time logs",
  },
  {
    key: "task_history.view",
    description: "View task stage history",
  },
  {
    key: "recurrence.view",
    description: "View task recurrence schedules",
  },
  {
    key: "recurrence.manage",
    description: "Manage task recurrence schedules",
  },
  {
    key: "risk.view",
    description: "View task risk indicators",
  },
  {
    key: "risk.update",
    description: "Update manual task risk level",
  },
  {
    key: "risk.configure",
    description: "Configure workspace risk rules",
  },
  {
    key: "sla.view",
    description: "View SLA policies and task SLA state",
  },
  {
    key: "sla.configure",
    description: "Configure SLA policies and business calendars",
  },
  {
    key: "sla.override",
    description: "Pause, resume, or override SLA instances",
  },
  {
    key: "automation.view",
    description: "View automation history",
  },
  {
    key: "automation.manage",
    description: "Manage automation configuration",
  },
  {
    key: "automation.retry",
    description: "Retry failed automation jobs",
  },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const SYSTEM_ROLE_KEYS = ["owner", "admin", "manager", "member"] as const;

export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

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
    "tasks:delete",
    "tasks:assign",
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
    "tasks:delete",
    "tasks:assign",
    "dashboard:read",
    "activity:read",
    ...COLLAB_MEMBER,
    ...PHASE_72_MEMBER,
    ...PHASE_73_MEMBER,
  ],
};

export const INVITABLE_ROLE_KEYS: SystemRoleKey[] = ["admin", "manager", "member"];

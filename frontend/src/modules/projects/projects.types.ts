export type ProjectStatus =
  | "PLANNING"
  | "ACTIVE"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELLED"
  | "ARCHIVED";

export type ProjectRole =
  | "PROJECT_OWNER"
  | "PROJECT_MANAGER"
  | "PROJECT_MEMBER"
  | "PROJECT_VIEWER";

export type ProjectVisibility = "WORKSPACE" | "PRIVATE";

export type ProjectPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type ProjectHealth = "GOOD" | "AT_RISK" | "CRITICAL";

export type ProjectCompletionPolicy = "WARN_ONLY" | "BLOCK" | "BLOCK_WITH_OVERRIDE";

export type ProjectMemberRecord = {
  userId: string;
  projectRole: ProjectRole;
  joinedAt: string | null;
  id: string;
  fullName: string | null;
  email: string | null;
  roleKey: string | null;
  status: string | null;
};

export type ProjectManagerSummary = {
  id: string;
  fullName: string | null;
  email: string | null;
};

export type ProjectRecord = {
  id: string;
  workspaceId: string | null;
  name: string;
  code: string | null;
  description: string | null;
  status: ProjectStatus | string;
  priority: ProjectPriority | string;
  visibility: ProjectVisibility | null;
  managerId: string | null;
  manager: ProjectManagerSummary | null;
  startAt: string | null;
  endAt: string | null;
  completionPolicy: ProjectCompletionPolicy | string;
  completedAt: string | null;
  archivedAt: string | null;
  deletedAt: string | null;
  createdById: string | null;
  memberIds: string[];
  members: ProjectMemberRecord[];
  openTasks: number | null;
  totalTasks: number | null;
  overdueTasks: number | null;
  progressPercent: number | null;
  health: ProjectHealth | string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ProjectListFilters = {
  search?: string;
  status?: ProjectStatus | ProjectStatus[];
  managerId?: string;
  memberId?: string;
  startFrom?: string;
  startTo?: string;
  endFrom?: string;
  endTo?: string;
  includeArchived?: boolean;
  archivedOnly?: boolean;
  includeDeleted?: boolean;
  deletedOnly?: boolean;
  sortBy?: "name" | "status" | "startAt" | "endAt" | "updatedAt" | "priority";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type ProjectListResult = {
  items: ProjectRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type CreateProjectInput = {
  name: string;
  code?: string;
  description?: string;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  visibility?: ProjectVisibility;
  managerId?: string;
  startAt?: string;
  endAt?: string;
  completionPolicy?: ProjectCompletionPolicy;
  memberIds?: string[];
  members?: Array<{ userId: string; projectRole: ProjectRole }>;
};

export type UpdateProjectInput = {
  name?: string;
  code?: string | null;
  description?: string | null;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  visibility?: ProjectVisibility;
  managerId?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  completionPolicy?: ProjectCompletionPolicy;
  completionOverrideReason?: string;
  memberIds?: string[];
};

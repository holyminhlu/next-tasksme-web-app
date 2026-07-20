export type UserStatus =
  | "PENDING_VERIFICATION"
  | "ACTIVE"
  | "LOCKED"
  | "DISABLED";

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  status: UserStatus;
};

export type WorkspaceType = "PERSONAL" | "ORGANIZATION";

export type OnboardingStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  type: WorkspaceType;
  roleKey: string;
  membershipId: string;
  onboardingStatus: OnboardingStatus | null;
  currentStep: string | null;
};

export type AuthProfile = AuthUser & {
  emailVerifiedAt: string | null;
  lastActiveWorkspaceId: string | null;
  workspaces: WorkspaceSummary[];
};

export type AuthSession = {
  id: string;
  familyId: string;
  rememberMe: boolean;
  expiresAt: string;
  absoluteExpiresAt: string;
  lastUsedAt: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  current: boolean;
};

export type LoginInput = {
  email: string;
  password: string;
  rememberMe?: boolean;
};

export type RegisterInput = {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
};

export type VerifyEmailInput = {
  token: string;
};

export type ResendVerificationInput = {
  email: string;
};

export type ForgotPasswordInput = {
  email: string;
};

export type ResetPasswordInput = {
  token: string;
  password: string;
  confirmPassword: string;
};

export type ChangePasswordInput = {
  currentPassword: string;
  password: string;
  confirmPassword: string;
};

export type SelectWorkspaceInput = {
  workspaceId: string;
};

export type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};

export type RegisterResponse = {
  user: AuthUser;
  requiresEmailVerification: boolean;
};

export type InvitationPreview = {
  email: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
    type: WorkspaceType;
  };
  roleKey: string;
  expiresAt: string;
};

export type AcceptInvitationInput = {
  token: string;
  fullName?: string;
  password?: string;
  confirmPassword?: string;
};

export type AcceptInvitationResponse = {
  workspaceId: string;
  roleKey: string;
  userId: string;
};

export type WorkspaceMemberSummary = {
  id: string;
  status: string;
  user: AuthUser;
  role: { id: string; key: string; name?: string };
  createdAt: string;
};

export type AuthStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "session-expired";

export type PermissionKey =
  | "workspace:read"
  | "workspace:update"
  | "members:read"
  | "members:invite"
  | "members:update"
  | "members:remove"
  | "ownership:transfer"
  | "roles:read"
  | "roles:manage"
  | "modules:manage"
  | "projects:read"
  | "projects:create"
  | "projects:update"
  | "tasks:read"
  | "tasks:create"
  | "tasks:update"
  | "tasks:assign"
  | "tasks:delete"
  | "projects:delete"
  | "dashboard:read"
  | "activity:read"
  | "checklist.manage"
  | "tag.view"
  | "tag.create"
  | "tag.update"
  | "tag.delete"
  | "task.tag.manage"
  | "custom_field.view"
  | "custom_field.configure"
  | "custom_field.value.update"
  | "comment.view"
  | "comment.create"
  | "comment.update_own"
  | "comment.delete_own"
  | "comment.moderate"
  | "attachment.view"
  | "attachment.upload"
  | "attachment.delete_own"
  | "attachment.manage"
  | "task_dependency.view"
  | "task_dependency.manage"
  | "task_dependency.override"
  | "time_log.view_own"
  | "time_log.create"
  | "time_log.update_own"
  | "time_log.delete_own"
  | "time_log.view_all"
  | "time_log.manage_all"
  | "task_history.view"
  | "recurrence.view"
  | "recurrence.manage"
  | "risk.view"
  | "risk.update"
  | "risk.configure"
  | "sla.view"
  | "sla.configure"
  | "sla.override"
  | "automation.view"
  | "automation.manage"
  | "automation.retry";

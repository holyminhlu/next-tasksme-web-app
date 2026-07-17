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

export type CompanySummary = {
  id: string;
  name: string;
  slug: string;
  roleKey: string;
  membershipId: string;
};

export type AuthProfile = AuthUser & {
  emailVerifiedAt: string | null;
  companies: CompanySummary[];
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
  companyName: string;
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

export type SelectCompanyInput = {
  companyId: string;
};

export type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};

export type RegisterResponse = {
  user: AuthUser;
  company: {
    id: string;
    name: string;
    slug: string;
  };
  requiresEmailVerification: boolean;
};

export type InvitationPreview = {
  email: string;
  company: {
    id: string;
    name: string;
    slug: string;
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
  companyId: string;
  roleKey: string;
  userId: string;
};

export type AuthStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "session-expired";

export type PermissionKey =
  | "company:read"
  | "company:update"
  | "members:read"
  | "members:invite"
  | "members:update"
  | "members:remove"
  | "ownership:transfer"
  | "roles:read"
  | "roles:manage";

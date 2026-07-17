import {
  clearAccessToken,
  del,
  get,
  post,
  setAccessToken,
} from "@/lib/api/client";
import type {
  AcceptInvitationInput,
  AcceptInvitationResponse,
  AuthProfile,
  AuthSession,
  ChangePasswordInput,
  ForgotPasswordInput,
  InvitationPreview,
  LoginInput,
  LoginResponse,
  RegisterInput,
  RegisterResponse,
  ResendVerificationInput,
  ResetPasswordInput,
  SelectWorkspaceInput,
  VerifyEmailInput,
  WorkspaceSummary,
} from "./auth.types";

export async function register(input: RegisterInput) {
  return post<RegisterResponse>("/auth/register", input, { skipAuth: true });
}

export async function login(input: LoginInput) {
  const result = await post<LoginResponse>("/auth/login", input, {
    skipAuth: true,
  });

  if (result.success) {
    setAccessToken(result.data.accessToken);
  }

  return result;
}

export async function logout() {
  const result = await post<{ loggedOut: boolean }>(
    "/auth/logout",
    undefined,
    { skipAuth: true },
  );
  clearAccessToken();
  return result;
}

export async function logoutAll() {
  const result = await post<{ loggedOutAll: boolean }>("/auth/logout-all");
  clearAccessToken();
  return result;
}

export async function refresh() {
  const result = await post<LoginResponse>("/auth/refresh", undefined, {
    skipAuth: true,
    skipRefresh: true,
  });

  if (result.success) {
    setAccessToken(result.data.accessToken);
  } else {
    clearAccessToken();
  }

  return result;
}

export async function me() {
  return get<AuthProfile>("/auth/me");
}

export async function listWorkspaces() {
  return get<WorkspaceSummary[]>("/me/workspaces");
}

export async function selectWorkspace(input: SelectWorkspaceInput) {
  return post<WorkspaceSummary>("/auth/select-workspace", input);
}

export async function verifyEmail(input: VerifyEmailInput) {
  return post<{ verified: boolean }>("/auth/verify-email", input, {
    skipAuth: true,
  });
}

export async function resendVerification(input: ResendVerificationInput) {
  return post<{ message: string }>("/auth/resend-verification", input, {
    skipAuth: true,
  });
}

export async function forgotPassword(input: ForgotPasswordInput) {
  return post<{ message: string }>("/auth/forgot-password", input, {
    skipAuth: true,
  });
}

export async function resetPassword(input: ResetPasswordInput) {
  const result = await post<{ reset: boolean }>(
    "/auth/reset-password",
    input,
    { skipAuth: true },
  );
  clearAccessToken();
  return result;
}

export async function changePassword(input: ChangePasswordInput) {
  const result = await post<{ changed: boolean }>(
    "/auth/change-password",
    input,
  );
  clearAccessToken();
  return result;
}

export async function listSessions() {
  return get<AuthSession[]>("/auth/sessions");
}

export async function revokeSession(sessionId: string) {
  return del<{ revoked: boolean }>(`/auth/sessions/${sessionId}`);
}

export async function previewInvitation(token: string) {
  const query = new URLSearchParams({ token });
  return get<InvitationPreview>(`/invitations/preview?${query.toString()}`, {
    skipAuth: true,
  });
}

export async function acceptInvitation(
  input: AcceptInvitationInput,
  options?: { authenticated?: boolean },
) {
  return post<AcceptInvitationResponse>("/invitations/accept", input, {
    skipAuth: !options?.authenticated,
  });
}

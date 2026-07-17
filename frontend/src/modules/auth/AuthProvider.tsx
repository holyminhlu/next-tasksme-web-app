"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as authService from "./auth.service";
import type {
  AuthProfile,
  AuthStatus,
  AuthUser,
  LoginInput,
  PermissionKey,
  RegisterInput,
  WorkspaceSummary,
} from "./auth.types";
import { permissionsForRole } from "./permissions";

const SELECTED_WORKSPACE_KEY = "taskmng:selected-workspace-id";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  profile: AuthProfile | null;
  workspaces: WorkspaceSummary[];
  selectedWorkspace: WorkspaceSummary | null;
  permissions: PermissionKey[];
  error: string | null;
  login: (input: LoginInput) => Promise<{ ok: boolean; message?: string }>;
  register: (
    input: RegisterInput,
  ) => Promise<{ ok: boolean; message?: string; requiresEmailVerification?: boolean }>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  selectWorkspace: (
    workspaceId: string,
  ) => Promise<{ ok: boolean; message?: string }>;
  markSessionExpired: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredWorkspaceId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(SELECTED_WORKSPACE_KEY);
}

function writeStoredWorkspaceId(workspaceId: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (workspaceId) {
    window.localStorage.setItem(SELECTED_WORKSPACE_KEY, workspaceId);
  } else {
    window.localStorage.removeItem(SELECTED_WORKSPACE_KEY);
  }
}

function resolveSelectedWorkspace(
  workspaces: WorkspaceSummary[],
  lastActiveWorkspaceId: string | null,
): WorkspaceSummary | null {
  if (workspaces.length === 0) {
    return null;
  }

  const storedId = readStoredWorkspaceId();
  const stored = storedId
    ? workspaces.find((workspace) => workspace.id === storedId)
    : undefined;

  if (stored) {
    return stored;
  }

  const lastActive = lastActiveWorkspaceId
    ? workspaces.find((workspace) => workspace.id === lastActiveWorkspaceId)
    : undefined;

  if (lastActive) {
    writeStoredWorkspaceId(lastActive.id);
    return lastActive;
  }

  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] =
    useState<WorkspaceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyProfile = useCallback((nextProfile: AuthProfile | null) => {
    setProfile(nextProfile);

    if (!nextProfile) {
      setSelectedWorkspace(null);
      writeStoredWorkspaceId(null);
      return;
    }

    const nextSelected = resolveSelectedWorkspace(
      nextProfile.workspaces,
      nextProfile.lastActiveWorkspaceId,
    );
    setSelectedWorkspace(nextSelected);
  }, []);

  const bootstrap = useCallback(async () => {
    setStatus("loading");
    setError(null);

    const refreshResult = await authService.refresh();

    if (!refreshResult.success) {
      setProfile(null);
      setSelectedWorkspace(null);
      setStatus("unauthenticated");
      return;
    }

    const meResult = await authService.me();

    if (!meResult.success) {
      await authService.logout();
      setProfile(null);
      setSelectedWorkspace(null);
      setStatus(
        meResult.error.code === "UNAUTHORIZED"
          ? "session-expired"
          : "unauthenticated",
      );
      return;
    }

    applyProfile(meResult.data);
    setStatus("authenticated");
  }, [applyProfile]);

  useEffect(() => {
    // Bootstrap session from HttpOnly refresh cookie on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async auth initialization
    void bootstrap();
  }, [bootstrap]);

  const login = useCallback(
    async (input: LoginInput) => {
      setError(null);
      const result = await authService.login(input);

      if (!result.success) {
        return { ok: false, message: result.error.message };
      }

      const meResult = await authService.me();

      if (!meResult.success) {
        await authService.logout();
        setStatus("session-expired");
        return { ok: false, message: meResult.error.message };
      }

      applyProfile(meResult.data);
      setStatus("authenticated");
      return { ok: true };
    },
    [applyProfile],
  );

  const register = useCallback(async (input: RegisterInput) => {
    setError(null);
    const result = await authService.register(input);

    if (!result.success) {
      return { ok: false, message: result.error.message };
    }

    return {
      ok: true,
      requiresEmailVerification: result.data.requiresEmailVerification,
    };
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setProfile(null);
    setSelectedWorkspace(null);
    writeStoredWorkspaceId(null);
    setStatus("unauthenticated");
  }, []);

  const logoutAll = useCallback(async () => {
    await authService.logoutAll();
    setProfile(null);
    setSelectedWorkspace(null);
    writeStoredWorkspaceId(null);
    setStatus("unauthenticated");
  }, []);

  const refreshProfile = useCallback(async () => {
    const meResult = await authService.me();

    if (!meResult.success) {
      if (meResult.error.code === "UNAUTHORIZED") {
        setStatus("session-expired");
      }
      return;
    }

    applyProfile(meResult.data);
    setStatus("authenticated");
  }, [applyProfile]);

  const selectWorkspace = useCallback(
    async (workspaceId: string) => {
      const result = await authService.selectWorkspace({ workspaceId });

      if (!result.success) {
        return { ok: false, message: result.error.message };
      }

      writeStoredWorkspaceId(workspaceId);
      setSelectedWorkspace(result.data);
      await refreshProfile();
      return { ok: true };
    },
    [refreshProfile],
  );

  const markSessionExpired = useCallback(() => {
    setProfile(null);
    setSelectedWorkspace(null);
    writeStoredWorkspaceId(null);
    setStatus("session-expired");
  }, []);

  const permissions = useMemo(
    () =>
      selectedWorkspace
        ? permissionsForRole(selectedWorkspace.roleKey)
        : [],
    [selectedWorkspace],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: profile,
      profile,
      workspaces: profile?.workspaces ?? [],
      selectedWorkspace,
      permissions,
      error,
      login,
      register,
      logout,
      logoutAll,
      refreshProfile,
      selectWorkspace,
      markSessionExpired,
    }),
    [
      status,
      profile,
      selectedWorkspace,
      permissions,
      error,
      login,
      register,
      logout,
      logoutAll,
      refreshProfile,
      selectWorkspace,
      markSessionExpired,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}

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
  CompanySummary,
  LoginInput,
  PermissionKey,
  RegisterInput,
} from "./auth.types";
import { permissionsForRole } from "./permissions";

const SELECTED_COMPANY_KEY = "taskmng:selected-company-id";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  profile: AuthProfile | null;
  companies: CompanySummary[];
  selectedCompany: CompanySummary | null;
  permissions: PermissionKey[];
  error: string | null;
  login: (input: LoginInput) => Promise<{ ok: boolean; message?: string }>;
  register: (
    input: RegisterInput,
  ) => Promise<{ ok: boolean; message?: string; requiresEmailVerification?: boolean }>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  selectCompany: (companyId: string) => Promise<{ ok: boolean; message?: string }>;
  markSessionExpired: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredCompanyId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(SELECTED_COMPANY_KEY);
}

function writeStoredCompanyId(companyId: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (companyId) {
    window.localStorage.setItem(SELECTED_COMPANY_KEY, companyId);
  } else {
    window.localStorage.removeItem(SELECTED_COMPANY_KEY);
  }
}

function resolveSelectedCompany(
  companies: CompanySummary[],
): CompanySummary | null {
  if (companies.length === 0) {
    return null;
  }

  const storedId = readStoredCompanyId();
  const stored = storedId
    ? companies.find((company) => company.id === storedId)
    : undefined;

  if (stored) {
    return stored;
  }

  if (companies.length === 1) {
    writeStoredCompanyId(companies[0]!.id);
    return companies[0]!;
  }

  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<CompanySummary | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const applyProfile = useCallback((nextProfile: AuthProfile | null) => {
    setProfile(nextProfile);

    if (!nextProfile) {
      setSelectedCompany(null);
      writeStoredCompanyId(null);
      return;
    }

    const nextSelected = resolveSelectedCompany(nextProfile.companies);
    setSelectedCompany(nextSelected);
  }, []);

  const bootstrap = useCallback(async () => {
    setStatus("loading");
    setError(null);

    const refreshResult = await authService.refresh();

    if (!refreshResult.success) {
      setProfile(null);
      setSelectedCompany(null);
      setStatus("unauthenticated");
      return;
    }

    const meResult = await authService.me();

    if (!meResult.success) {
      await authService.logout();
      setProfile(null);
      setSelectedCompany(null);
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
    setSelectedCompany(null);
    writeStoredCompanyId(null);
    setStatus("unauthenticated");
  }, []);

  const logoutAll = useCallback(async () => {
    await authService.logoutAll();
    setProfile(null);
    setSelectedCompany(null);
    writeStoredCompanyId(null);
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

  const selectCompany = useCallback(
    async (companyId: string) => {
      const result = await authService.selectCompany({ companyId });

      if (!result.success) {
        return { ok: false, message: result.error.message };
      }

      writeStoredCompanyId(companyId);
      setSelectedCompany(result.data);
      await refreshProfile();
      return { ok: true };
    },
    [refreshProfile],
  );

  const markSessionExpired = useCallback(() => {
    setProfile(null);
    setSelectedCompany(null);
    writeStoredCompanyId(null);
    setStatus("session-expired");
  }, []);

  const permissions = useMemo(
    () =>
      selectedCompany
        ? permissionsForRole(selectedCompany.roleKey)
        : [],
    [selectedCompany],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: profile,
      profile,
      companies: profile?.companies ?? [],
      selectedCompany,
      permissions,
      error,
      login,
      register,
      logout,
      logoutAll,
      refreshProfile,
      selectCompany,
      markSessionExpired,
    }),
    [
      status,
      profile,
      selectedCompany,
      permissions,
      error,
      login,
      register,
      logout,
      logoutAll,
      refreshProfile,
      selectCompany,
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

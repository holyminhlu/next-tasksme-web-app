"use client";

import type { ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import type { PermissionKey } from "./auth.types";
import { hasPermission } from "./permissions";

type CanProps = {
  permission: PermissionKey | PermissionKey[];
  fallback?: ReactNode;
  children: ReactNode;
};

export function Can({ permission, fallback = null, children }: CanProps) {
  const { permissions } = useAuth();

  if (!hasPermission(permissions, permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import styles from "./auth.module.css";

type AuthGateProps = {
  children: ReactNode;
  requireCompany?: boolean;
};

export function AuthGate({ children, requireCompany = false }: AuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { status, selectedCompany, companies } = useAuth();

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (status === "session-expired") {
      router.replace("/session-expired");
      return;
    }

    if (status === "unauthenticated") {
      const redirect = encodeURIComponent(
        `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`,
      );
      router.replace(`/login?redirect=${redirect}`);
      return;
    }

    if (
      requireCompany &&
      !selectedCompany &&
      companies.length > 1 &&
      pathname !== "/select-company"
    ) {
      router.replace("/select-company");
    }
  }, [
    status,
    router,
    pathname,
    searchParams,
    selectedCompany,
    companies.length,
    requireCompany,
  ]);

  if (status === "loading") {
    return <div className={styles.loading}>Loading session...</div>;
  }

  if (status !== "authenticated") {
    return <div className={styles.loading}>Redirecting...</div>;
  }

  if (
    requireCompany &&
    !selectedCompany &&
    companies.length > 1 &&
    pathname !== "/select-company"
  ) {
    return <div className={styles.loading}>Redirecting...</div>;
  }

  return <>{children}</>;
}

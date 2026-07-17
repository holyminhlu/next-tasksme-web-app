"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense } from "react";
import { AuthGate, useAuth } from "@/modules/auth";
import styles from "@/modules/auth/auth.module.css";

function AppHeader() {
  const router = useRouter();
  const { user, companies, selectedCompany, selectCompany, logout } = useAuth();

  async function handleCompanyChange(companyId: string) {
    if (!companyId) {
      return;
    }

    await selectCompany(companyId);
  }

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <header className={styles.appHeader}>
      <div className={styles.appBrand}>TaskMng SME</div>
      <div className={styles.appActions}>
        {companies.length > 0 && (
          <select
            className={styles.companySelect}
            value={selectedCompany?.id ?? ""}
            onChange={(event) => handleCompanyChange(event.target.value)}
            aria-label="Active company"
          >
            <option value="" disabled>
              Select company
            </option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        )}
        {companies.length > 1 && (
          <Link href="/select-company" className={styles.secondaryButton}>
            Switch company
          </Link>
        )}
        <span className={styles.muted}>{user?.email}</span>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={handleLogout}
        >
          Log out
        </button>
      </div>
    </header>
  );
}

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.appShell}>
      <AppHeader />
      <main className={styles.appMain}>{children}</main>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
      <AuthGate requireCompany>
        <AppLayoutContent>{children}</AppLayoutContent>
      </AuthGate>
    </Suspense>
  );
}

"use client";

import Link from "next/link";
import { Can, useAuth } from "@/modules/auth";
import styles from "@/modules/auth/auth.module.css";

export default function DashboardPage() {
  const { user, profile, companies, selectedCompany, permissions } = useAuth();

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h1>Dashboard</h1>
        <p>Signed in as {user?.fullName ?? user?.email}</p>
      </div>

      <div className={styles.form}>
        <div>
          <span className={styles.muted}>Email</span>
          <p>{profile?.email}</p>
        </div>

        <div>
          <span className={styles.muted}>Status</span>
          <p>{profile?.status}</p>
        </div>

        <div>
          <span className={styles.muted}>Active company</span>
          <p>
            {selectedCompany
              ? `${selectedCompany.name} (${selectedCompany.roleKey})`
              : "None selected"}
          </p>
        </div>

        <div>
          <span className={styles.muted}>Companies</span>
          {companies.length === 0 ? (
            <p>No companies</p>
          ) : (
            <ul className={styles.companyList}>
              {companies.map((company) => (
                <li key={company.id} className={styles.muted}>
                  {company.name} · {company.roleKey}
                </li>
              ))}
            </ul>
          )}
        </div>

        <Can permission="members:invite">
          <p className={styles.success}>
            You can invite members in this workspace.
          </p>
        </Can>

        <p className={styles.muted}>
          Effective permissions: {permissions.join(", ") || "none"}
        </p>

        <Link href="/" className={styles.secondaryButton}>
          View health status
        </Link>
      </div>
    </div>
  );
}

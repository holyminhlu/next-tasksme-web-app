"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import {
  AuthCard,
  AuthGate,
  FormError,
  useAuth,
} from "@/modules/auth";
import styles from "@/modules/auth/auth.module.css";

function SelectCompanyContent() {
  const router = useRouter();
  const { companies, selectCompany } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);

  async function handleSelect(companyId: string) {
    setSubmitting(companyId);
    setError(null);

    const result = await selectCompany(companyId);

    if (!result.ok) {
      setError(result.message ?? "Could not select company");
      setSubmitting(null);
      return;
    }

    router.replace("/dashboard");
  }

  return (
    <AuthCard
      title="Select company"
      description="Choose which company workspace you want to use."
      footer={
        <>
          <Link href="/dashboard">Skip for now</Link>
        </>
      }
    >
      <FormError message={error} />

      {companies.length === 0 ? (
        <p className={styles.muted}>No companies are linked to your account.</p>
      ) : (
        <div className={styles.companyList}>
          {companies.map((company) => (
            <button
              key={company.id}
              type="button"
              className={styles.companyOption}
              disabled={submitting === company.id}
              onClick={() => handleSelect(company.id)}
            >
              <div>
                <strong>{company.name}</strong>
                <span>{company.roleKey}</span>
              </div>
              <span>{submitting === company.id ? "..." : "Select"}</span>
            </button>
          ))}
        </div>
      )}
    </AuthCard>
  );
}

export default function SelectCompanyPage() {
  return (
    <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
      <AuthGate>
        <SelectCompanyContent />
      </AuthGate>
    </Suspense>
  );
}

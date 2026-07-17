"use client";

import Link from "next/link";
import { AuthCard } from "@/modules/auth";
import styles from "@/modules/auth/auth.module.css";

export default function ForbiddenPage() {
  return (
    <AuthCard
      title="Access denied"
      description="You do not have permission to view this page."
      footer={
        <>
          Go to <Link href="/dashboard">dashboard</Link> or{" "}
          <Link href="/">home</Link>
        </>
      }
    >
      <p className={styles.muted}>
        Contact your workspace administrator if you believe this is a mistake.
      </p>
    </AuthCard>
  );
}

"use client";

import Link from "next/link";
import { AuthCard } from "@/modules/auth";
import styles from "@/modules/auth/auth.module.css";

export default function SessionExpiredPage() {
  return (
    <AuthCard
      title="Session expired"
      description="Your session is no longer valid. Sign in again to continue."
      footer={
        <>
          <Link href="/login">Sign in again</Link>
        </>
      }
    >
      <p className={styles.muted}>
        For security, access tokens expire quickly and refresh sessions can be
        revoked after password changes or logout from all devices.
      </p>
    </AuthCard>
  );
}

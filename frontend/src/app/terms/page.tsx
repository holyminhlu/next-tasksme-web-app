import Link from "next/link";
import { AuthCard } from "@/modules/auth";
import styles from "@/modules/auth/auth.module.css";

export const metadata = { title: "Terms of Service · TaskMng SME" };

export default function TermsPage() {
  return (
    <AuthCard
      title="Terms of Service"
      description="Summary of the terms that apply when using TaskMng SME."
      footer={
        <>
          Back to <Link href="/register">registration</Link>
        </>
      }
    >
      <div className={styles.form}>
        <p className={styles.muted}>
          By creating an account you agree to use TaskMng SME responsibly, keep
          your credentials secure, and respect the data of other members in
          your workspaces. The full legal terms will be published before
          general availability.
        </p>
      </div>
    </AuthCard>
  );
}

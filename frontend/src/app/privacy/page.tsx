import Link from "next/link";
import { AuthCard } from "@/modules/auth";
import styles from "@/modules/auth/auth.module.css";

export const metadata = { title: "Privacy Policy · TaskMng SME" };

export default function PrivacyPage() {
  return (
    <AuthCard
      title="Privacy Policy"
      description="How TaskMng SME handles your personal data."
      footer={
        <>
          Back to <Link href="/register">registration</Link>
        </>
      }
    >
      <div className={styles.form}>
        <p className={styles.muted}>
          We store only the data needed to run your workspaces: your profile,
          workspace content, and audit logs. We never sell personal data. The
          full policy will be published before general availability.
        </p>
      </div>
    </AuthCard>
  );
}

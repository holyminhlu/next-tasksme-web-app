import type { Metadata } from "next";
import Link from "next/link";
import { Wrench } from "lucide-react";
import { StatusScreen } from "@/components/pwa/StatusScreen";
import styles from "@/components/pwa/status-screen.module.css";

export const metadata: Metadata = {
  title: "Scheduled maintenance | Task SME",
};

export default function MaintenancePage() {
  return (
    <StatusScreen
      icon={<Wrench size={28} aria-hidden="true" />}
      title="Scheduled maintenance"
      description="Task SME is temporarily unavailable while we perform maintenance. Your data is safe. Please check back in a little while."
      actions={
        <Link href="/" className={styles.primaryButton}>
          Try again
        </Link>
      }
    />
  );
}

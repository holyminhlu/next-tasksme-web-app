import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { StatusScreen } from "@/components/pwa/StatusScreen";
import styles from "@/components/pwa/status-screen.module.css";

export const metadata: Metadata = {
  title: "Page not found | Task SME",
};

export default function NotFound() {
  return (
    <StatusScreen
      icon={<SearchX size={28} aria-hidden="true" />}
      title="Page not found"
      description="The page you are looking for does not exist or may have been moved. Check the address, or head back to your workspace."
      actions={
        <>
          <Link href="/dashboard" className={styles.primaryButton}>
            Go to dashboard
          </Link>
          <Link href="/" className={styles.secondaryLink}>
            Go to home
          </Link>
        </>
      }
    />
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { StatusScreen } from "@/components/pwa/StatusScreen";
import {
  formatErrorReference,
  getErrorReference,
} from "@/components/pwa/error-info";
import styles from "@/components/pwa/status-screen.module.css";

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function RouteError({ error, reset }: RouteErrorProps) {
  useEffect(() => {
    // Log for diagnostics; the UI only ever shows sanitized copy.
    console.error(error);
  }, [error]);

  const reference = formatErrorReference(getErrorReference(error));

  return (
    <StatusScreen
      tone="danger"
      icon={<AlertTriangle size={28} aria-hidden="true" />}
      title="Something went wrong"
      description="An unexpected error occurred while loading this page. Your data is safe — you can try again, or come back later."
      meta={reference ? <code>{reference}</code> : undefined}
      actions={
        <>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => reset()}
          >
            <RotateCcw size={16} aria-hidden="true" />
            Try again
          </button>
          <Link href="/dashboard" className={styles.secondaryLink}>
            Go to dashboard
          </Link>
        </>
      }
    />
  );
}

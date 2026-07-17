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

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Replaces the root layout when it crashes, so it must render its own
 * <html> and <body> and cannot rely on globals.css being present.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const reference = formatErrorReference(getErrorReference(error));

  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <StatusScreen
          tone="danger"
          icon={<AlertTriangle size={28} aria-hidden="true" />}
          title="Task SME hit an unexpected error"
          description="The application failed to load. Try again — if the problem persists, contact support with the reference below."
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
              <Link href="/" className={styles.secondaryLink}>
                Go to home
              </Link>
            </>
          }
        />
      </body>
    </html>
  );
}

"use client";

import { RotateCcw } from "lucide-react";
import styles from "@/components/pwa/status-screen.module.css";

export function RetryButton() {
  return (
    <button
      type="button"
      className={styles.primaryButton}
      onClick={() => window.location.reload()}
    >
      <RotateCcw size={16} aria-hidden="true" />
      Try again
    </button>
  );
}

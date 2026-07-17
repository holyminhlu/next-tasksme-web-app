"use client";

import { RefreshCw, X } from "lucide-react";
import styles from "./pwa.module.css";

type UpdatePromptProps = {
  onUpdate: () => void;
  onDismiss: () => void;
};

/**
 * Toast shown when a new service worker version is waiting to activate.
 * Announced politely to screen readers via aria-live.
 */
export function UpdatePrompt({ onUpdate, onDismiss }: UpdatePromptProps) {
  return (
    <div className={styles.toast} role="status" aria-live="polite">
      <span className={styles.toastIcon} aria-hidden="true">
        <RefreshCw size={18} />
      </span>
      <div className={styles.toastBody}>
        <span className={styles.toastTitle}>Update available</span>
        <span className={styles.toastText}>
          A new version of Task SME is ready.
        </span>
      </div>
      <div className={styles.toastActions}>
        <button type="button" className={styles.toastButton} onClick={onUpdate}>
          Refresh
        </button>
        <button
          type="button"
          className={styles.dismissButton}
          onClick={onDismiss}
          aria-label="Dismiss update notification"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import styles from "./pwa.module.css";
import {
  INSTALL_PROMPT_DISMISSED_KEY,
  isStandaloneDisplayMode,
  shouldShowIosInstallHint,
  type BeforeInstallPromptEvent,
} from "./pwa-utils";

type InstallState =
  | { kind: "hidden" }
  | { kind: "installable"; prompt: BeforeInstallPromptEvent }
  | { kind: "ios-hint" };

/**
 * Install guidance: uses the native beforeinstallprompt flow on Chromium
 * browsers and shows manual "Add to Home Screen" guidance on iOS Safari.
 */
export function InstallPrompt() {
  const [state, setState] = useState<InstallState>({ kind: "hidden" });

  useEffect(() => {
    if (isStandaloneDisplayMode(window)) {
      return;
    }

    let dismissed = false;
    try {
      dismissed =
        window.localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY) === "true";
    } catch {
      // Storage unavailable (private mode); treat as not dismissed.
    }

    if (dismissed) {
      return;
    }

    // iOS Safari never fires beforeinstallprompt; show manual guidance
    // instead. Slightly delayed so it does not compete with page load.
    let iosHintTimer: number | undefined;
    if (
      shouldShowIosInstallHint({
        userAgent: window.navigator.userAgent,
        isStandalone: false,
        dismissed,
      })
    ) {
      iosHintTimer = window.setTimeout(() => {
        setState({ kind: "ios-hint" });
      }, 1000);
      return () => window.clearTimeout(iosHintTimer);
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setState({
        kind: "installable",
        prompt: event as BeforeInstallPromptEvent,
      });
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
    };
  }, []);

  if (state.kind === "hidden") {
    return null;
  }

  const dismiss = () => {
    try {
      window.localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, "true");
    } catch {
      // Best effort only.
    }
    setState({ kind: "hidden" });
  };

  const install = async () => {
    if (state.kind !== "installable") {
      return;
    }
    await state.prompt.prompt();
    const choice = await state.prompt.userChoice;
    if (choice.outcome === "accepted") {
      setState({ kind: "hidden" });
    } else {
      dismiss();
    }
  };

  return (
    <div className={styles.toast} role="status" aria-live="polite">
      <span className={styles.toastIcon} aria-hidden="true">
        {state.kind === "ios-hint" ? <Share size={18} /> : <Download size={18} />}
      </span>
      <div className={styles.toastBody}>
        <span className={styles.toastTitle}>Install Task SME</span>
        <span className={styles.toastText}>
          {state.kind === "ios-hint"
            ? "In Safari, tap Share and choose “Add to Home Screen”."
            : "Add the app to your device for quick access."}
        </span>
      </div>
      <div className={styles.toastActions}>
        {state.kind === "installable" && (
          <button type="button" className={styles.toastButton} onClick={install}>
            Install
          </button>
        )}
        <button
          type="button"
          className={styles.dismissButton}
          onClick={dismiss}
          aria-label="Dismiss install suggestion"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

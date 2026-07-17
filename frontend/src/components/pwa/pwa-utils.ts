export const INSTALL_PROMPT_DISMISSED_KEY = "tasksme.installPromptDismissed";

/** Chromium's non-standard event fired when the app is installable. */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function isIosUserAgent(userAgent: string): boolean {
  return /iphone|ipad|ipod/i.test(userAgent);
}

/**
 * iOS Safari has no beforeinstallprompt event, so install guidance is shown
 * manually — but only outside standalone mode and if not dismissed before.
 */
export function shouldShowIosInstallHint(options: {
  userAgent: string;
  isStandalone: boolean;
  dismissed: boolean;
}): boolean {
  return (
    isIosUserAgent(options.userAgent) &&
    !options.isStandalone &&
    !options.dismissed
  );
}

/** True when running as an installed app (standalone display mode). */
export function isStandaloneDisplayMode(win: {
  matchMedia?: (query: string) => { matches: boolean };
  navigator?: unknown;
}): boolean {
  if (win.matchMedia?.("(display-mode: standalone)").matches) {
    return true;
  }
  // iOS Safari exposes the non-standard navigator.standalone instead.
  const nav = win.navigator as { standalone?: boolean } | undefined;
  return nav?.standalone === true;
}

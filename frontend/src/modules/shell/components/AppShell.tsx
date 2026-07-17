"use client";

import { Focus } from "lucide-react";
import type { ReactNode } from "react";
import { useShell } from "../ShellProvider";
import { useViewport } from "../useViewport";
import { CommandPalette } from "./CommandPalette";
import { MobileBottomNav, MobileNavDrawer } from "./MobileNav";
import { NotificationCenter } from "./NotificationCenter";
import { QuickCreateDialogs } from "./QuickCreateDialogs";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import styles from "./AppShell.module.css";

/**
 * Responsive application frame:
 * - desktop (>=1024px): full sidebar, collapsible via preference
 * - tablet (768-1023px): icon-only (collapsed) sidebar
 * - mobile (<768px): no sidebar; top bar menu + drawer + bottom nav
 * Focus mode hides all chrome and shows a floating exit control.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { focusMode, setFocusMode, sidebarCollapsed } = useShell();
  const viewport = useViewport();

  const showSidebar = !focusMode && viewport !== "mobile";
  const sidebarIsCollapsed = viewport === "tablet" || sidebarCollapsed;
  const showTopBar = !focusMode;
  const showBottomNav = !focusMode && viewport === "mobile";

  return (
    <div
      className={`${styles.shell} ${focusMode ? styles.shellFocus : ""}`.trim()}
    >
      <a href="#main-content" className={styles.skipLink}>
        Skip to main content
      </a>

      {showSidebar && <Sidebar collapsed={sidebarIsCollapsed} />}

      <div className={styles.main}>
        {showTopBar && <TopBar showMenuButton={viewport === "mobile"} />}
        <main id="main-content" className={styles.content} tabIndex={-1}>
          {children}
        </main>
        {showBottomNav && <MobileBottomNav />}
      </div>

      {focusMode && (
        <button
          type="button"
          className={styles.focusExit}
          onClick={() => setFocusMode(false)}
        >
          <Focus size={16} aria-hidden />
          Exit focus mode
          <span className={styles.focusExitShortcut} aria-hidden>
            Ctrl Shift F
          </span>
        </button>
      )}

      <CommandPalette />
      <QuickCreateDialogs />
      <NotificationCenter />
      <MobileNavDrawer />
    </div>
  );
}

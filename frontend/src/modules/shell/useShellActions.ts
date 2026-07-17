"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { CommandAction } from "./commands";
import { useShell } from "./ShellProvider";

/** Executes a command palette action against shell state / navigation. */
export function useShellActions() {
  const router = useRouter();
  const shell = useShell();

  return useCallback(
    (action: CommandAction) => {
      if (action.type === "navigate") {
        router.push(action.href);
        return;
      }

      switch (action.actionId) {
        case "toggle-focus-mode":
          shell.toggleFocusMode();
          break;
        case "toggle-sidebar":
          shell.toggleSidebar();
          break;
        case "quick-create-task":
          shell.setQuickCreate("task");
          break;
        case "quick-create-project":
          shell.setQuickCreate("project");
          break;
        case "quick-invite-member":
          shell.setQuickCreate("invite");
          break;
        case "mark-all-notifications-read":
          shell.markAllNotificationsRead();
          break;
        case "set-theme-light":
          shell.setTheme("light");
          break;
        case "set-theme-dark":
          shell.setTheme("dark");
          break;
        case "set-theme-system":
          shell.setTheme("system");
          break;
      }
    },
    [router, shell],
  );
}

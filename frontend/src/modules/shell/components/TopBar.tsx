"use client";

import {
  Bell,
  FolderKanban,
  Menu,
  Plus,
  Search,
  UserPlus,
} from "lucide-react";
import { Can, useAuth } from "@/modules/auth";
import {
  DropdownMenu,
  IconButton,
  MenuItem,
  MenuLabel,
  Tooltip,
} from "@/modules/design-system";
import { isModuleEnabled } from "../navigation";
import { useShell } from "../ShellProvider";
import { Breadcrumbs } from "./Breadcrumbs";
import { UserMenu } from "./UserMenu";
import styles from "./TopBar.module.css";

function QuickCreateMenu() {
  const { navContext, setQuickCreate } = useShell();
  const { selectedWorkspace } = useAuth();
  const isOrganization = selectedWorkspace?.type === "ORGANIZATION";
  const tasksEnabled = isModuleEnabled(navContext, "tasks");
  const projectsEnabled = isModuleEnabled(navContext, "projects");

  return (
    <DropdownMenu
      align="end"
      menuLabel="Quick create"
      trigger={(props, open) => (
        <Tooltip content="Quick create" disabled={open}>
          <IconButton {...props} aria-label="Quick create" outline>
            <Plus size={18} />
          </IconButton>
        </Tooltip>
      )}
    >
      <MenuLabel>Create</MenuLabel>
      {tasksEnabled && (
        <Can permission="tasks:create">
          <MenuItem
            icon={<Plus size={16} />}
            description="Capture a task for this workspace"
            onSelect={() => setQuickCreate("task")}
          >
            New task
          </MenuItem>
        </Can>
      )}
      {projectsEnabled && (
        <Can permission="projects:create">
          <MenuItem
            icon={<FolderKanban size={16} />}
            description="Organize related work"
            onSelect={() => setQuickCreate("project")}
          >
            New project
          </MenuItem>
        </Can>
      )}
      {isOrganization && (
        <Can permission="members:invite">
          <MenuItem
            icon={<UserPlus size={16} />}
            description="Send a workspace invitation"
            onSelect={() => setQuickCreate("invite")}
          >
            Invite member
          </MenuItem>
        </Can>
      )}
    </DropdownMenu>
  );
}

export function TopBar({ showMenuButton }: { showMenuButton: boolean }) {
  const {
    setCommandPaletteOpen,
    setNotificationsOpen,
    setMobileNavOpen,
    unreadNotificationIds,
  } = useShell();

  const unreadCount = unreadNotificationIds.length;

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        {showMenuButton && (
          <IconButton
            aria-label="Open navigation menu"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu size={20} />
          </IconButton>
        )}
        <Breadcrumbs />
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.searchButton}
          onClick={() => setCommandPaletteOpen(true)}
          aria-label="Open command palette"
        >
          <Search size={15} aria-hidden />
          <span className={styles.searchLabel}>Search</span>
          <span className={styles.shortcutHint} aria-hidden>
            Ctrl K
          </span>
        </button>

        <QuickCreateMenu />

        <span className={styles.bellWrapper}>
          <Tooltip content="Notifications">
            <IconButton
              aria-label={
                unreadCount > 0
                  ? `Notifications, ${unreadCount} unread`
                  : "Notifications"
              }
              onClick={() => setNotificationsOpen(true)}
            >
              <Bell size={18} />
            </IconButton>
          </Tooltip>
          {unreadCount > 0 && (
            <span className={styles.unreadBadge} aria-hidden>
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </span>

        <UserMenu />
      </div>
    </header>
  );
}

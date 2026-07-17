"use client";

import { useRouter } from "next/navigation";
import { KeyRound, LogOut, Monitor, Moon, Sun, User } from "lucide-react";
import { useAuth } from "@/modules/auth";
import {
  DropdownMenu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
} from "@/modules/design-system";
import { useShell } from "../ShellProvider";
import styles from "./TopBar.module.css";

function userInitials(name: string | undefined, email: string | undefined): string {
  const source = name?.trim() || email || "?";

  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserMenu() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useShell();

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <DropdownMenu
      align="end"
      menuLabel="Account"
      trigger={(props) => (
        <button
          {...props}
          type="button"
          className={styles.avatarButton}
          aria-label={`Account menu for ${user?.fullName ?? user?.email ?? "user"}`}
        >
          {userInitials(user?.fullName, user?.email)}
        </button>
      )}
    >
      <div className={styles.userSummary}>
        <span className={styles.userName}>{user?.fullName ?? "Account"}</span>
        <span className={styles.userEmail}>{user?.email}</span>
      </div>
      <MenuSeparator />
      <MenuItem
        icon={<User size={16} />}
        onSelect={() => router.push("/settings/profile")}
      >
        Profile settings
      </MenuItem>
      <MenuItem
        icon={<KeyRound size={16} />}
        onSelect={() => router.push("/settings/security")}
      >
        Security
      </MenuItem>
      <MenuSeparator />
      <MenuLabel>Theme</MenuLabel>
      <MenuItem
        icon={<Sun size={16} />}
        selected={theme === "light"}
        closeOnSelect={false}
        onSelect={() => setTheme("light")}
      >
        Light
      </MenuItem>
      <MenuItem
        icon={<Moon size={16} />}
        selected={theme === "dark"}
        closeOnSelect={false}
        onSelect={() => setTheme("dark")}
      >
        Dark
      </MenuItem>
      <MenuItem
        icon={<Monitor size={16} />}
        selected={theme === "system"}
        closeOnSelect={false}
        onSelect={() => setTheme("system")}
      >
        System
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        danger
        icon={<LogOut size={16} />}
        onSelect={() => void handleLogout()}
      >
        Log out
      </MenuItem>
    </DropdownMenu>
  );
}

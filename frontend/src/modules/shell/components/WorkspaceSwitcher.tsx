"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Building2, ChevronDown, User } from "lucide-react";
import { useAuth } from "@/modules/auth";
import {
  isOnboardingIncomplete,
  resumeOnboardingUrl,
} from "@/modules/onboarding/routing";
import {
  DropdownMenu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  useToast,
} from "@/modules/design-system";
import styles from "./WorkspaceSwitcher.module.css";

function workspaceInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "W"
  );
}

export function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const { workspaces, selectedWorkspace, selectWorkspace } = useAuth();

  async function handleSelect(workspaceId: string) {
    if (workspaceId === selectedWorkspace?.id) {
      return;
    }

    const result = await selectWorkspace(workspaceId);

    if (!result.ok) {
      toast({
        title: "Could not switch workspace",
        description: result.message,
        tone: "error",
      });
      return;
    }

    const next = workspaces.find((workspace) => workspace.id === workspaceId);

    if (next && isOnboardingIncomplete(next)) {
      router.replace(resumeOnboardingUrl(next));
    }
  }

  if (!selectedWorkspace) {
    return null;
  }

  return (
    <DropdownMenu
      className={styles.wrapper}
      menuLabel="Switch workspace"
      trigger={(props) => (
        <button
          {...props}
          type="button"
          className={`${styles.trigger} ${collapsed ? styles.collapsedTrigger : ""}`.trim()}
          aria-label={`Active workspace: ${selectedWorkspace.name}. Open workspace switcher.`}
        >
          <span className={styles.avatar} aria-hidden>
            {workspaceInitials(selectedWorkspace.name)}
          </span>
          {!collapsed && (
            <>
              <span className={styles.details}>
                <span className={styles.name}>{selectedWorkspace.name}</span>
                <span className={styles.type}>
                  {selectedWorkspace.type === "PERSONAL"
                    ? "Personal"
                    : "Organization"}{" "}
                  · {selectedWorkspace.roleKey}
                </span>
              </span>
              <ChevronDown size={16} className={styles.chevron} aria-hidden />
            </>
          )}
        </button>
      )}
    >
      <MenuLabel>Workspaces</MenuLabel>
      {workspaces.map((workspace) => (
        <MenuItem
          key={workspace.id}
          selected={workspace.id === selectedWorkspace.id}
          icon={
            workspace.type === "PERSONAL" ? (
              <User size={16} />
            ) : (
              <Building2 size={16} />
            )
          }
          description={
            workspace.type === "PERSONAL"
              ? `Personal · ${workspace.roleKey}`
              : `Organization · ${workspace.roleKey}`
          }
          onSelect={() => void handleSelect(workspace.id)}
        >
          {workspace.name}
        </MenuItem>
      ))}
      <MenuSeparator />
      <MenuItem
        icon={<ArrowRight size={16} />}
        onSelect={() => router.push("/select-workspace")}
      >
        All workspaces
      </MenuItem>
    </DropdownMenu>
  );
}

/**
 * Command palette model. Commands are derived from route metadata plus shell
 * actions, filtered by the same permission/type/module rules as navigation.
 */

import type { LucideIcon } from "lucide-react";
import {
  BellOff,
  Focus,
  Monitor,
  Moon,
  PanelLeftClose,
  Plus,
  Sun,
  UserPlus,
} from "lucide-react";
import type { PermissionKey, WorkspaceType } from "@/modules/auth";
import {
  isRouteVisible,
  visibleRoutes,
  type NavContext,
  type RouteMeta,
} from "./navigation";

export type ShellActionId =
  | "toggle-focus-mode"
  | "toggle-sidebar"
  | "quick-create-task"
  | "quick-create-project"
  | "quick-invite-member"
  | "mark-all-notifications-read"
  | "set-theme-light"
  | "set-theme-dark"
  | "set-theme-system";

export type CommandAction =
  | { type: "navigate"; href: string }
  | { type: "action"; actionId: ShellActionId };

export type CommandGroup = "navigation" | "actions" | "preferences";

export type Command = {
  id: string;
  label: string;
  keywords: string[];
  group: CommandGroup;
  icon: LucideIcon;
  action: CommandAction;
  /** Optional hint rendered next to the label (e.g. destination path). */
  hint?: string;
};

type ActionCommandMeta = {
  id: string;
  label: string;
  keywords: string[];
  group: CommandGroup;
  icon: LucideIcon;
  actionId: ShellActionId;
  requiresPermission?: PermissionKey | PermissionKey[];
  workspaceTypes?: WorkspaceType[];
  requiresModule?: string;
};

const ACTION_COMMANDS: ActionCommandMeta[] = [
  {
    id: "action-create-task",
    label: "Create task",
    keywords: ["new", "task", "todo", "add"],
    group: "actions",
    icon: Plus,
    actionId: "quick-create-task",
    requiresPermission: "tasks:create",
    requiresModule: "tasks",
  },
  {
    id: "action-create-project",
    label: "Create project",
    keywords: ["new", "project", "add"],
    group: "actions",
    icon: Plus,
    actionId: "quick-create-project",
    requiresPermission: "projects:create",
    requiresModule: "projects",
  },
  {
    id: "action-invite-member",
    label: "Invite member",
    keywords: ["invite", "member", "teammate", "email"],
    group: "actions",
    icon: UserPlus,
    actionId: "quick-invite-member",
    requiresPermission: "members:invite",
    workspaceTypes: ["ORGANIZATION"],
  },
  {
    id: "action-mark-notifications-read",
    label: "Mark all notifications as read",
    keywords: ["notifications", "read", "clear", "inbox"],
    group: "actions",
    icon: BellOff,
    actionId: "mark-all-notifications-read",
  },
  {
    id: "pref-toggle-focus",
    label: "Toggle focus mode",
    keywords: ["focus", "zen", "distraction", "hide"],
    group: "preferences",
    icon: Focus,
    actionId: "toggle-focus-mode",
  },
  {
    id: "pref-toggle-sidebar",
    label: "Toggle sidebar",
    keywords: ["sidebar", "collapse", "expand", "navigation"],
    group: "preferences",
    icon: PanelLeftClose,
    actionId: "toggle-sidebar",
  },
  {
    id: "pref-theme-light",
    label: "Switch to light theme",
    keywords: ["theme", "light", "appearance"],
    group: "preferences",
    icon: Sun,
    actionId: "set-theme-light",
  },
  {
    id: "pref-theme-dark",
    label: "Switch to dark theme",
    keywords: ["theme", "dark", "appearance"],
    group: "preferences",
    icon: Moon,
    actionId: "set-theme-dark",
  },
  {
    id: "pref-theme-system",
    label: "Use system theme",
    keywords: ["theme", "system", "auto", "appearance"],
    group: "preferences",
    icon: Monitor,
    actionId: "set-theme-system",
  },
];

function navigationCommand(route: RouteMeta): Command {
  return {
    id: `nav-${route.id}`,
    label: `Go to ${route.label}`,
    keywords: [route.label.toLowerCase(), route.href, route.description ?? ""],
    group: "navigation",
    icon: route.icon,
    hint: route.href,
    action: { type: "navigate", href: route.href },
  };
}

/** Builds the permission/type/module aware command list for a context. */
export function buildCommands(context: NavContext): Command[] {
  const navCommands = visibleRoutes(context).map(navigationCommand);

  const actionCommands = ACTION_COMMANDS.filter((meta) =>
    isRouteVisible(
      {
        id: meta.id,
        href: "",
        label: meta.label,
        icon: meta.icon,
        section: "main",
        requiresPermission: meta.requiresPermission,
        workspaceTypes: meta.workspaceTypes,
        requiresModule: meta.requiresModule,
      },
      context,
    ),
  ).map<Command>((meta) => ({
    id: meta.id,
    label: meta.label,
    keywords: meta.keywords,
    group: meta.group,
    icon: meta.icon,
    action: { type: "action", actionId: meta.actionId },
  }));

  return [...navCommands, ...actionCommands];
}

/**
 * Case-insensitive token match: every whitespace-separated token of the query
 * must appear in the label or a keyword. Empty query returns all commands.
 */
export function filterCommands(commands: Command[], query: string): Command[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    return commands;
  }

  return commands.filter((command) => {
    const haystack = [command.label, ...command.keywords]
      .join(" ")
      .toLowerCase();

    return tokens.every((token) => haystack.includes(token));
  });
}

export const COMMAND_GROUP_LABELS: Record<CommandGroup, string> = {
  navigation: "Navigate",
  actions: "Actions",
  preferences: "Preferences",
};

/**
 * Central route metadata for the app shell. Sidebar, mobile nav, breadcrumbs,
 * the command palette and settings navigation all derive from this config so
 * permission / workspace-type / module filtering stays consistent.
 */

import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Blocks,
  Building2,
  CheckSquare,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  Settings,
  Shield,
  TriangleAlert,
  User,
  Users,
} from "lucide-react";
import type { PermissionKey, WorkspaceType } from "@/modules/auth";

export type NavSection = "main" | "settings";

export type RouteMeta = {
  id: string;
  href: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  section: NavSection;
  /** Id of the parent route, used to build breadcrumb trails. */
  parentId?: string;
  /** All listed permissions are required; omit for "visible to everyone". */
  requiresPermission?: PermissionKey | PermissionKey[];
  /** Restrict to specific workspace types; omit for all types. */
  workspaceTypes?: WorkspaceType[];
  /** Workspace module key that must be enabled (e.g. "tasks", "projects"). */
  requiresModule?: string;
  showInSidebar?: boolean;
  showInMobileNav?: boolean;
  pinnable?: boolean;
};

export const APP_ROUTES: RouteMeta[] = [
  {
    id: "dashboard",
    href: "/dashboard",
    label: "Dashboard",
    description: "Workspace overview and quick links",
    icon: LayoutDashboard,
    section: "main",
    showInSidebar: true,
    showInMobileNav: true,
    pinnable: true,
  },
  {
    id: "my-tasks",
    href: "/my-tasks",
    label: "My tasks",
    description: "Tasks assigned to you across projects",
    icon: CheckSquare,
    section: "main",
    requiresPermission: "tasks:read",
    requiresModule: "tasks",
    showInSidebar: true,
    showInMobileNav: true,
    pinnable: true,
  },
  {
    id: "projects",
    href: "/projects",
    label: "Projects",
    description: "Browse and organize workspace projects",
    icon: FolderKanban,
    section: "main",
    requiresPermission: "projects:read",
    requiresModule: "projects",
    showInSidebar: true,
    showInMobileNav: true,
    pinnable: true,
  },
  {
    id: "notifications",
    href: "/notifications",
    label: "Notifications",
    description: "Activity and alerts for this workspace",
    icon: Bell,
    section: "main",
    showInSidebar: true,
    showInMobileNav: false,
    pinnable: true,
  },
  {
    id: "settings",
    href: "/settings",
    label: "Settings",
    description: "Personal and workspace configuration",
    icon: Settings,
    section: "main",
    showInSidebar: true,
    showInMobileNav: true,
    pinnable: false,
  },
  {
    id: "settings-profile",
    href: "/settings/profile",
    label: "Profile",
    description: "Your name, email and personal details",
    icon: User,
    section: "settings",
    parentId: "settings",
  },
  {
    id: "settings-security",
    href: "/settings/security",
    label: "Security",
    description: "Password and active sessions",
    icon: KeyRound,
    section: "settings",
    parentId: "settings",
  },
  {
    id: "settings-notifications",
    href: "/settings/notifications",
    label: "Notifications",
    description: "How you want to be notified",
    icon: Bell,
    section: "settings",
    parentId: "settings",
  },
  {
    id: "settings-workspace",
    href: "/settings/workspace",
    label: "Workspace",
    description: "Name, type and workspace details",
    icon: Building2,
    section: "settings",
    parentId: "settings",
    requiresPermission: "workspace:read",
  },
  {
    id: "settings-members",
    href: "/settings/members",
    label: "Members",
    description: "Invite and manage teammates",
    icon: Users,
    section: "settings",
    parentId: "settings",
    requiresPermission: "members:read",
    workspaceTypes: ["ORGANIZATION"],
    requiresModule: "members",
  },
  {
    id: "settings-roles",
    href: "/settings/roles",
    label: "Roles",
    description: "Roles and their permissions",
    icon: Shield,
    section: "settings",
    parentId: "settings",
    requiresPermission: "roles:read",
    workspaceTypes: ["ORGANIZATION"],
  },
  {
    id: "settings-modules",
    href: "/settings/modules",
    label: "Modules",
    description: "Enable or disable workspace features",
    icon: Blocks,
    section: "settings",
    parentId: "settings",
    requiresPermission: "workspace:read",
  },
  {
    id: "settings-danger",
    href: "/settings/danger",
    label: "Danger zone",
    description: "Ownership transfer and deletion",
    icon: TriangleAlert,
    section: "settings",
    parentId: "settings",
    requiresPermission: "workspace:update",
  },
];

export type NavContext = {
  workspaceType: WorkspaceType | null;
  permissions: PermissionKey[];
  /**
   * Enabled module keys for the workspace, or null when unknown (not loaded
   * yet / API failed). Unknown degrades safely: module filters are skipped.
   */
  enabledModuleKeys: string[] | null;
};

export function isRouteVisible(route: RouteMeta, context: NavContext): boolean {
  if (route.workspaceTypes && context.workspaceType) {
    if (!route.workspaceTypes.includes(context.workspaceType)) {
      return false;
    }
  }

  if (route.requiresPermission) {
    const required = Array.isArray(route.requiresPermission)
      ? route.requiresPermission
      : [route.requiresPermission];

    if (!required.every((key) => context.permissions.includes(key))) {
      return false;
    }
  }

  if (route.requiresModule && context.enabledModuleKeys !== null) {
    if (!context.enabledModuleKeys.includes(route.requiresModule)) {
      return false;
    }
  }

  return true;
}

export function visibleRoutes(
  context: NavContext,
  routes: RouteMeta[] = APP_ROUTES,
): RouteMeta[] {
  return routes.filter((route) => isRouteVisible(route, context));
}

export function sidebarRoutes(context: NavContext): RouteMeta[] {
  return visibleRoutes(context).filter((route) => route.showInSidebar);
}

export function mobileNavRoutes(context: NavContext): RouteMeta[] {
  return visibleRoutes(context).filter((route) => route.showInMobileNav);
}

export function settingsRoutes(context: NavContext): RouteMeta[] {
  return visibleRoutes(context).filter((route) => route.section === "settings");
}

export function findRouteById(id: string): RouteMeta | undefined {
  return APP_ROUTES.find((route) => route.id === id);
}

/** Longest-prefix match so nested paths resolve to their closest route. */
export function findRouteByPath(pathname: string): RouteMeta | undefined {
  let best: RouteMeta | undefined;

  for (const route of APP_ROUTES) {
    const matches =
      pathname === route.href || pathname.startsWith(`${route.href}/`);

    if (matches && (!best || route.href.length > best.href.length)) {
      best = route;
    }
  }

  return best;
}

/** Breadcrumb trail from the root ancestor to the route matching pathname. */
export function breadcrumbTrail(pathname: string): RouteMeta[] {
  const route = findRouteByPath(pathname);

  if (!route) {
    return [];
  }

  const trail: RouteMeta[] = [route];
  let current = route;

  while (current.parentId) {
    const parent = findRouteById(current.parentId);

    if (!parent) {
      break;
    }

    trail.unshift(parent);
    current = parent;
  }

  return trail;
}

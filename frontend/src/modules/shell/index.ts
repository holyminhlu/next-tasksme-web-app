export { ShellProvider, useShell } from "./ShellProvider";
export type { QuickCreateKind, QuickCreateOptions } from "./ShellProvider";
export { AppShell } from "./components/AppShell";
export { PageHeader } from "./components/PageHeader";
export { NotificationList } from "./components/NotificationCenter";
export { useShellActions } from "./useShellActions";
export { useViewport } from "./useViewport";
export {
  APP_ROUTES,
  breadcrumbTrail,
  findRouteById,
  findRouteByPath,
  isRouteVisible,
  mobileNavRoutes,
  settingsRoutes,
  sidebarRoutes,
  visibleRoutes,
} from "./navigation";
export type { NavContext, NavSection, RouteMeta } from "./navigation";
export {
  buildCommands,
  COMMAND_GROUP_LABELS,
  filterCommands,
} from "./commands";
export type { Command, CommandAction, CommandGroup, ShellActionId } from "./commands";
export {
  DEFAULT_SHELL_PREFERENCES,
  loadShellPreferences,
  parseShellPreferences,
  pushRecentNavId,
  saveShellPreferences,
  serializeShellPreferences,
  shellPreferencesKey,
  togglePinnedNavId,
} from "./preferences";
export type {
  KeyValueStorage,
  ShellPreferences,
  ThemePreference,
} from "./preferences";
export { seededNotifications, unreadNotifications } from "./notifications";
export type { ShellNotification, ShellNotificationKind } from "./notifications";

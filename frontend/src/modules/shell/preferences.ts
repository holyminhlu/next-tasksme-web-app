/**
 * Shell UI preferences persisted to localStorage, namespaced per workspace.
 *
 * Only non-sensitive UI state lives here (sidebar, theme, pinned/recent nav,
 * locally read notification ids). Nothing security-relevant is stored.
 */

export type ThemePreference = "light" | "dark" | "system";

export type ShellPreferences = {
  sidebarCollapsed: boolean;
  focusMode: boolean;
  theme: ThemePreference;
  /** Route ids pinned by the user, in pin order. */
  pinnedNavIds: string[];
  /** Route ids recently visited, most recent first. */
  recentNavIds: string[];
  /** Legacy local read-ids (unused once backend notifications are available). */
  readNotificationIds: string[];
  /** Device-only UI prefs; workspace `taskAssigned` lives on the server. */
  notificationPrefs: {
    productUpdates: boolean;
    taskReminders: boolean;
    mentionAlerts: boolean;
  };
};

export const DEFAULT_SHELL_PREFERENCES: ShellPreferences = {
  sidebarCollapsed: false,
  focusMode: false,
  theme: "system",
  pinnedNavIds: [],
  recentNavIds: [],
  readNotificationIds: [],
  notificationPrefs: {
    productUpdates: true,
    taskReminders: true,
    mentionAlerts: true,
  },
};

const PREFERENCES_VERSION = "v1";
const PREFERENCES_PREFIX = "taskmng:shell";

export const MAX_RECENT_NAV_IDS = 5;

/** Storage key namespaced by workspace so preferences never leak across workspaces. */
export function shellPreferencesKey(workspaceId: string | null): string {
  return `${PREFERENCES_PREFIX}:${PREFERENCES_VERSION}:${workspaceId ?? "no-workspace"}`;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isTheme(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * Parses a raw persisted value, merging with defaults so older or corrupted
 * payloads degrade safely instead of breaking the shell.
 */
export function parseShellPreferences(raw: string | null): ShellPreferences {
  if (!raw) {
    return { ...DEFAULT_SHELL_PREFERENCES };
  }

  let candidate: unknown;

  try {
    candidate = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_SHELL_PREFERENCES };
  }

  if (typeof candidate !== "object" || candidate === null) {
    return { ...DEFAULT_SHELL_PREFERENCES };
  }

  const value = candidate as Record<string, unknown>;
  const prefs = value.notificationPrefs as Record<string, unknown> | undefined;

  return {
    sidebarCollapsed:
      typeof value.sidebarCollapsed === "boolean"
        ? value.sidebarCollapsed
        : DEFAULT_SHELL_PREFERENCES.sidebarCollapsed,
    focusMode:
      typeof value.focusMode === "boolean"
        ? value.focusMode
        : DEFAULT_SHELL_PREFERENCES.focusMode,
    theme: isTheme(value.theme) ? value.theme : DEFAULT_SHELL_PREFERENCES.theme,
    pinnedNavIds: isStringArray(value.pinnedNavIds) ? value.pinnedNavIds : [],
    recentNavIds: isStringArray(value.recentNavIds)
      ? value.recentNavIds.slice(0, MAX_RECENT_NAV_IDS)
      : [],
    readNotificationIds: isStringArray(value.readNotificationIds)
      ? value.readNotificationIds
      : [],
    notificationPrefs: {
      productUpdates:
        typeof prefs?.productUpdates === "boolean"
          ? prefs.productUpdates
          : DEFAULT_SHELL_PREFERENCES.notificationPrefs.productUpdates,
      taskReminders:
        typeof prefs?.taskReminders === "boolean"
          ? prefs.taskReminders
          : DEFAULT_SHELL_PREFERENCES.notificationPrefs.taskReminders,
      mentionAlerts:
        typeof prefs?.mentionAlerts === "boolean"
          ? prefs.mentionAlerts
          : DEFAULT_SHELL_PREFERENCES.notificationPrefs.mentionAlerts,
    },
  };
}

export function serializeShellPreferences(prefs: ShellPreferences): string {
  return JSON.stringify(prefs);
}

export type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function loadShellPreferences(
  storage: KeyValueStorage,
  workspaceId: string | null,
): ShellPreferences {
  try {
    return parseShellPreferences(storage.getItem(shellPreferencesKey(workspaceId)));
  } catch {
    return { ...DEFAULT_SHELL_PREFERENCES };
  }
}

export function saveShellPreferences(
  storage: KeyValueStorage,
  workspaceId: string | null,
  prefs: ShellPreferences,
): void {
  try {
    storage.setItem(
      shellPreferencesKey(workspaceId),
      serializeShellPreferences(prefs),
    );
  } catch {
    // Quota or privacy-mode failures are non-fatal for UI preferences.
  }
}

/** Adds a route id to the head of the recent list (deduped, capped). */
export function pushRecentNavId(
  recent: string[],
  id: string,
  max: number = MAX_RECENT_NAV_IDS,
): string[] {
  const next = [id, ...recent.filter((existing) => existing !== id)];
  return next.slice(0, max);
}

/** Toggles a route id in the pinned list, preserving pin order. */
export function togglePinnedNavId(pinned: string[], id: string): string[] {
  return pinned.includes(id)
    ? pinned.filter((existing) => existing !== id)
    : [...pinned, id];
}

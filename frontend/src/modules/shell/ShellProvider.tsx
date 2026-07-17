"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/modules/auth";
import { listModules } from "@/modules/onboarding/onboarding.service";
import {
  DEFAULT_SHELL_PREFERENCES,
  loadShellPreferences,
  pushRecentNavId,
  saveShellPreferences,
  togglePinnedNavId,
  type ShellPreferences,
  type ThemePreference,
} from "./preferences";
import { findRouteByPath, type NavContext } from "./navigation";
import {
  seededNotifications,
  unreadNotifications,
  type ShellNotification,
} from "./notifications";

export type QuickCreateKind = "task" | "project" | "invite";

type PrefsState = {
  workspaceId: string | null;
  prefs: ShellPreferences;
};

type ShellContextValue = {
  /** UI preferences (persisted locally, per workspace). */
  preferences: ShellPreferences;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  focusMode: boolean;
  setFocusMode: (enabled: boolean) => void;
  toggleFocusMode: () => void;
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  pinnedNavIds: string[];
  togglePinned: (routeId: string) => void;
  recentNavIds: string[];
  setNotificationPref: (
    key: keyof ShellPreferences["notificationPrefs"],
    enabled: boolean,
  ) => void;

  /** Permission/type/module context used to filter navigation and commands. */
  navContext: NavContext;
  /** Re-fetch enabled modules (e.g. after toggling them in settings). */
  refreshModules: () => Promise<void>;

  /** Command palette. */
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  /** Quick create dialogs. */
  quickCreate: QuickCreateKind | null;
  setQuickCreate: (kind: QuickCreateKind | null) => void;

  /** Notification center (local notifications; no backend feed yet). */
  notifications: ShellNotification[];
  unreadNotificationIds: string[];
  notificationsOpen: boolean;
  setNotificationsOpen: (open: boolean) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  /** Mobile navigation drawer. */
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

function getStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function ShellProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { selectedWorkspace, permissions } = useAuth();
  const workspaceId = selectedWorkspace?.id ?? null;

  const [prefsState, setPrefsState] = useState<PrefsState | null>(null);
  const [enabledModuleKeys, setEnabledModuleKeys] = useState<string[] | null>(
    null,
  );
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [quickCreate, setQuickCreate] = useState<QuickCreateKind | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const prefs = prefsState?.prefs ?? DEFAULT_SHELL_PREFERENCES;
  const hydrated = prefsState !== null && prefsState.workspaceId === workspaceId;

  // Load persisted preferences whenever the active workspace changes.
  useEffect(() => {
    const storage = getStorage();

    if (!storage) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage can only be read client-side
    setPrefsState({
      workspaceId,
      prefs: loadShellPreferences(storage, workspaceId),
    });
  }, [workspaceId]);

  // Persist preference changes (after hydration, to avoid clobbering).
  useEffect(() => {
    const storage = getStorage();

    if (!storage || !prefsState) {
      return;
    }

    saveShellPreferences(storage, prefsState.workspaceId, prefsState.prefs);
  }, [prefsState]);

  const updatePrefs = useCallback(
    (updater: (current: ShellPreferences) => ShellPreferences) => {
      setPrefsState((current) =>
        current ? { ...current, prefs: updater(current.prefs) } : current,
      );
    },
    [],
  );

  const refreshModules = useCallback(async () => {
    if (!workspaceId) {
      setEnabledModuleKeys(null);
      return;
    }

    const result = await listModules(workspaceId);

    if (result.success) {
      setEnabledModuleKeys(
        result.data
          .filter((moduleRecord) => moduleRecord.enabled)
          .map((moduleRecord) => moduleRecord.moduleKey),
      );
    }
  }, [workspaceId]);

  // Fetch enabled modules for the workspace; degrade to null (no module
  // filtering) if the request fails or no workspace is selected.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset while switching workspaces
    setEnabledModuleKeys(null);
    void refreshModules();
  }, [refreshModules]);

  // Apply the theme preference to the document root. A future root theme
  // provider can take over by owning data-theme instead.
  useEffect(() => {
    const root = document.documentElement;

    function apply(theme: ThemePreference) {
      if (theme === "system") {
        const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        root.dataset.theme = dark ? "dark" : "light";
      } else {
        root.dataset.theme = theme;
      }
    }

    apply(prefs.theme);

    if (prefs.theme !== "system") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => apply("system");
    media.addEventListener("change", listener);

    return () => media.removeEventListener("change", listener);
  }, [prefs.theme]);

  // Track recently visited main-nav routes.
  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const route = findRouteByPath(pathname);

    if (!route || !route.pinnable) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- record visit once per navigation
    updatePrefs((current) => {
      const recentNavIds = pushRecentNavId(current.recentNavIds, route.id);

      if (recentNavIds.join("|") === current.recentNavIds.join("|")) {
        return current;
      }

      return { ...current, recentNavIds };
    });
  }, [pathname, hydrated, updatePrefs]);

  // Close transient surfaces on navigation.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close overlays after route change
    setMobileNavOpen(false);
    setCommandPaletteOpen(false);
  }, [pathname]);

  const toggleFocusMode = useCallback(() => {
    updatePrefs((current) => ({ ...current, focusMode: !current.focusMode }));
  }, [updatePrefs]);

  // Global keyboard shortcuts: Ctrl/Cmd+K palette, Ctrl/Cmd+Shift+F focus.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const modifier = event.ctrlKey || event.metaKey;

      if (modifier && !event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen((open) => !open);
        return;
      }

      if (modifier && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        toggleFocusMode();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleFocusMode]);

  const notifications = useMemo(
    () => seededNotifications(selectedWorkspace?.name ?? null),
    [selectedWorkspace?.name],
  );

  const unreadNotificationIds = useMemo(
    () =>
      unreadNotifications(notifications, prefs.readNotificationIds).map(
        (notification) => notification.id,
      ),
    [notifications, prefs.readNotificationIds],
  );

  const navContext = useMemo<NavContext>(
    () => ({
      workspaceType: selectedWorkspace?.type ?? null,
      permissions,
      enabledModuleKeys,
    }),
    [selectedWorkspace?.type, permissions, enabledModuleKeys],
  );

  const value = useMemo<ShellContextValue>(
    () => ({
      preferences: prefs,
      sidebarCollapsed: prefs.sidebarCollapsed,
      toggleSidebar: () =>
        updatePrefs((current) => ({
          ...current,
          sidebarCollapsed: !current.sidebarCollapsed,
        })),
      focusMode: prefs.focusMode,
      setFocusMode: (enabled) =>
        updatePrefs((current) => ({ ...current, focusMode: enabled })),
      toggleFocusMode,
      theme: prefs.theme,
      setTheme: (theme) => updatePrefs((current) => ({ ...current, theme })),
      pinnedNavIds: prefs.pinnedNavIds,
      togglePinned: (routeId) =>
        updatePrefs((current) => ({
          ...current,
          pinnedNavIds: togglePinnedNavId(current.pinnedNavIds, routeId),
        })),
      recentNavIds: prefs.recentNavIds,
      setNotificationPref: (key, enabled) =>
        updatePrefs((current) => ({
          ...current,
          notificationPrefs: { ...current.notificationPrefs, [key]: enabled },
        })),
      navContext,
      refreshModules,
      commandPaletteOpen,
      setCommandPaletteOpen,
      quickCreate,
      setQuickCreate,
      notifications,
      unreadNotificationIds,
      notificationsOpen,
      setNotificationsOpen,
      markNotificationRead: (id) =>
        updatePrefs((current) =>
          current.readNotificationIds.includes(id)
            ? current
            : {
                ...current,
                readNotificationIds: [...current.readNotificationIds, id],
              },
        ),
      markAllNotificationsRead: () =>
        updatePrefs((current) => ({
          ...current,
          readNotificationIds: notifications.map(
            (notification) => notification.id,
          ),
        })),
      mobileNavOpen,
      setMobileNavOpen,
    }),
    [
      prefs,
      updatePrefs,
      toggleFocusMode,
      navContext,
      refreshModules,
      commandPaletteOpen,
      quickCreate,
      notifications,
      unreadNotificationIds,
      notificationsOpen,
      mobileNavOpen,
    ],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell() {
  const context = useContext(ShellContext);

  if (!context) {
    throw new Error("useShell must be used within ShellProvider");
  }

  return context;
}

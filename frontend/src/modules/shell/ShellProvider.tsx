"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/modules/auth";
import { listModules } from "@/modules/onboarding/onboarding.service";
import {
  notificationsService,
  type WorkspaceNotification,
} from "@/modules/notifications";
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

export type QuickCreateKind = "task" | "project" | "invite";

export type QuickCreateOptions = {
  /** YYYY-MM-DD due date prefill for task create. */
  initialDueDate?: string;
};

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
  quickCreateOptions: QuickCreateOptions | null;
  setQuickCreate: (
    kind: QuickCreateKind | null,
    options?: QuickCreateOptions | null,
  ) => void;

  /** Backend workspace notifications. */
  notifications: WorkspaceNotification[];
  notificationsLoading: boolean;
  notificationsError: string | null;
  unreadNotificationCount: number;
  notificationsOpen: boolean;
  setNotificationsOpen: (open: boolean) => void;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;

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
  const [quickCreate, setQuickCreateState] = useState<QuickCreateKind | null>(
    null,
  );
  const [quickCreateOptions, setQuickCreateOptions] =
    useState<QuickCreateOptions | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notifications, setNotifications] = useState<WorkspaceNotification[]>(
    [],
  );
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(
    null,
  );
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

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

  const refreshNotifications = useCallback(async () => {
    if (!workspaceId) {
      setNotifications([]);
      setUnreadNotificationCount(0);
      setNotificationsError(null);
      setNotificationsLoading(false);
      return;
    }

    setNotificationsLoading(true);
    setNotificationsError(null);

    const [listResult, unreadResult] = await Promise.all([
      notificationsService.listNotifications(workspaceId, {
        page: 1,
        pageSize: 50,
      }),
      notificationsService.getUnreadNotificationCount(workspaceId),
    ]);

    setNotificationsLoading(false);

    if (!listResult.ok) {
      setNotifications([]);
      setUnreadNotificationCount(0);
      setNotificationsError(listResult.message);
      return;
    }

    setNotifications(listResult.data.items);
    setUnreadNotificationCount(
      unreadResult.ok
        ? unreadResult.data
        : listResult.data.items.filter((item) => !item.readAt).length,
    );
  }, [workspaceId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch workspace notifications
    void refreshNotifications();
  }, [refreshNotifications]);

  // Refresh when the drawer opens so the feed stays current.
  useEffect(() => {
    if (notificationsOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- refresh feed on open
      void refreshNotifications();
    }
  }, [notificationsOpen, refreshNotifications]);

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

  const markNotificationRead = useCallback(
    async (id: string) => {
      if (!workspaceId) {
        return;
      }

      const previous = notifications;
      const wasUnread = previous.some(
        (item) => item.id === id && !item.readAt,
      );

      setNotifications((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
            : item,
        ),
      );
      if (wasUnread) {
        setUnreadNotificationCount((count) => Math.max(0, count - 1));
      }

      const result = await notificationsService.markNotificationRead(
        workspaceId,
        id,
      );

      if (!result.ok) {
        setNotifications(previous);
        if (wasUnread) {
          setUnreadNotificationCount((count) => count + 1);
        }
        setNotificationsError(result.message);
        return;
      }

      setNotifications((current) =>
        current.map((item) => (item.id === id ? result.data : item)),
      );
    },
    [workspaceId, notifications],
  );

  const markAllNotificationsRead = useCallback(async () => {
    if (!workspaceId) {
      return;
    }

    const previous = notifications;
    const previousUnread = unreadNotificationCount;
    const unreadIds = previous
      .filter((item) => !item.readAt)
      .map((item) => item.id);

    setNotifications((current) =>
      current.map((item) =>
        item.readAt
          ? item
          : { ...item, readAt: new Date().toISOString() },
      ),
    );
    setUnreadNotificationCount(0);

    const result = await notificationsService.markAllNotificationsRead(
      workspaceId,
      unreadIds,
    );

    if (!result.ok) {
      setNotifications(previous);
      setUnreadNotificationCount(previousUnread);
      setNotificationsError(result.message);
      return;
    }

    await refreshNotifications();
  }, [
    workspaceId,
    notifications,
    unreadNotificationCount,
    refreshNotifications,
  ]);

  const navContext = useMemo<NavContext>(
    () => ({
      workspaceType: selectedWorkspace?.type ?? null,
      permissions,
      enabledModuleKeys,
    }),
    [selectedWorkspace?.type, permissions, enabledModuleKeys],
  );

  const setQuickCreate = useCallback(
    (kind: QuickCreateKind | null, options?: QuickCreateOptions | null) => {
      setQuickCreateState(kind);
      setQuickCreateOptions(kind ? (options ?? null) : null);
    },
    [],
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
      quickCreateOptions,
      setQuickCreate,
      notifications,
      notificationsLoading,
      notificationsError,
      unreadNotificationCount,
      notificationsOpen,
      setNotificationsOpen,
      refreshNotifications,
      markNotificationRead,
      markAllNotificationsRead,
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
      quickCreateOptions,
      setQuickCreate,
      notifications,
      notificationsLoading,
      notificationsError,
      unreadNotificationCount,
      notificationsOpen,
      refreshNotifications,
      markNotificationRead,
      markAllNotificationsRead,
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

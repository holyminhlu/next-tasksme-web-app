import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHELL_PREFERENCES,
  loadShellPreferences,
  MAX_RECENT_NAV_IDS,
  parseShellPreferences,
  pushRecentNavId,
  saveShellPreferences,
  serializeShellPreferences,
  shellPreferencesKey,
  togglePinnedNavId,
  type KeyValueStorage,
} from "./preferences";

function memoryStorage(): KeyValueStorage & { store: Map<string, string> } {
  const store = new Map<string, string>();

  return {
    store,
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
}

describe("shellPreferencesKey", () => {
  it("namespaces keys per workspace id", () => {
    expect(shellPreferencesKey("ws-1")).not.toBe(shellPreferencesKey("ws-2"));
    expect(shellPreferencesKey("ws-1")).toContain("ws-1");
  });

  it("uses a stable fallback when no workspace is selected", () => {
    expect(shellPreferencesKey(null)).toBe(shellPreferencesKey(null));
    expect(shellPreferencesKey(null)).not.toBe(shellPreferencesKey("ws-1"));
  });
});

describe("parseShellPreferences", () => {
  it("returns defaults for null, invalid JSON, and non-object payloads", () => {
    expect(parseShellPreferences(null)).toEqual(DEFAULT_SHELL_PREFERENCES);
    expect(parseShellPreferences("{not json")).toEqual(
      DEFAULT_SHELL_PREFERENCES,
    );
    expect(parseShellPreferences('"a string"')).toEqual(
      DEFAULT_SHELL_PREFERENCES,
    );
  });

  it("merges partial payloads with defaults", () => {
    const parsed = parseShellPreferences(
      JSON.stringify({ sidebarCollapsed: true, theme: "dark" }),
    );

    expect(parsed.sidebarCollapsed).toBe(true);
    expect(parsed.theme).toBe("dark");
    expect(parsed.pinnedNavIds).toEqual([]);
    expect(parsed.notificationPrefs).toEqual(
      DEFAULT_SHELL_PREFERENCES.notificationPrefs,
    );
  });

  it("rejects invalid field types instead of propagating them", () => {
    const parsed = parseShellPreferences(
      JSON.stringify({
        theme: "hotdog",
        pinnedNavIds: [1, 2, 3],
        recentNavIds: "dashboard",
        sidebarCollapsed: "yes",
      }),
    );

    expect(parsed).toEqual(DEFAULT_SHELL_PREFERENCES);
  });

  it("caps oversized recent lists", () => {
    const parsed = parseShellPreferences(
      JSON.stringify({
        recentNavIds: Array.from({ length: 20 }, (_, index) => `route-${index}`),
      }),
    );

    expect(parsed.recentNavIds).toHaveLength(MAX_RECENT_NAV_IDS);
  });
});

describe("load/save round trip", () => {
  it("persists per-workspace preferences without cross-workspace leaks", () => {
    const storage = memoryStorage();

    const wsA = {
      ...DEFAULT_SHELL_PREFERENCES,
      sidebarCollapsed: true,
      pinnedNavIds: ["projects"],
    };
    const wsB = { ...DEFAULT_SHELL_PREFERENCES, theme: "dark" as const };

    saveShellPreferences(storage, "ws-a", wsA);
    saveShellPreferences(storage, "ws-b", wsB);

    expect(loadShellPreferences(storage, "ws-a")).toEqual(wsA);
    expect(loadShellPreferences(storage, "ws-b")).toEqual(wsB);
    expect(loadShellPreferences(storage, "ws-c")).toEqual(
      DEFAULT_SHELL_PREFERENCES,
    );
  });

  it("serializes to JSON parseable by parseShellPreferences", () => {
    const prefs = {
      ...DEFAULT_SHELL_PREFERENCES,
      focusMode: true,
      recentNavIds: ["dashboard", "projects"],
    };

    expect(parseShellPreferences(serializeShellPreferences(prefs))).toEqual(
      prefs,
    );
  });

  it("swallows storage failures instead of throwing", () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {},
    };

    expect(loadShellPreferences(broken, "ws-a")).toEqual(
      DEFAULT_SHELL_PREFERENCES,
    );
    expect(() =>
      saveShellPreferences(broken, "ws-a", DEFAULT_SHELL_PREFERENCES),
    ).not.toThrow();
  });
});

describe("pushRecentNavId", () => {
  it("adds to the head and dedupes", () => {
    expect(pushRecentNavId(["a", "b"], "c")).toEqual(["c", "a", "b"]);
    expect(pushRecentNavId(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
  });

  it("caps the list length", () => {
    const recent = ["a", "b", "c", "d", "e"];
    expect(pushRecentNavId(recent, "f")).toEqual(["f", "a", "b", "c", "d"]);
  });
});

describe("togglePinnedNavId", () => {
  it("pins and unpins while preserving order", () => {
    expect(togglePinnedNavId([], "a")).toEqual(["a"]);
    expect(togglePinnedNavId(["a", "b"], "c")).toEqual(["a", "b", "c"]);
    expect(togglePinnedNavId(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });
});

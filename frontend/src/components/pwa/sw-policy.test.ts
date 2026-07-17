import { beforeAll, describe, expect, it, vi } from "vitest";

const ORIGIN = "http://localhost:3000";
const API_ORIGIN = "http://localhost:4000";

type SwInternals = {
  SW_VERSION: string;
  STATIC_CACHE: string;
  OFFLINE_URL: string;
  PRECACHE_URLS: string[];
  isApiOrAuthRequest: (url: URL) => boolean;
  isCacheableStaticAsset: (url: URL) => boolean;
  shouldHandleFetch: (
    request: { method: string; mode: string; headers: Headers },
    url: URL,
    origin: string,
  ) => boolean;
};

let sw: SwInternals;

function makeRequest(overrides: {
  method?: string;
  mode?: string;
  headers?: Record<string, string>;
}) {
  return {
    method: overrides.method ?? "GET",
    mode: overrides.mode ?? "no-cors",
    headers: new Headers(overrides.headers ?? {}),
  };
}

beforeAll(async () => {
  // The service worker script attaches its internals to `self` for testing.
  (globalThis as Record<string, unknown>).self = {
    addEventListener: vi.fn(),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
    location: { origin: ORIGIN },
  };

  // @ts-expect-error sw.js is a classic service worker script, not a module;
  // importing it here only runs its side effects.
  await import("../../../public/sw.js");
  sw = (globalThis as unknown as { self: { __TASKSME_SW__: SwInternals } })
    .self.__TASKSME_SW__;
});

describe("service worker precache configuration", () => {
  it("uses a versioned cache name", () => {
    expect(sw.STATIC_CACHE).toContain(sw.SW_VERSION);
    expect(sw.STATIC_CACHE.startsWith("tasksme-")).toBe(true);
  });

  it("precaches the offline page and brand assets", () => {
    expect(sw.PRECACHE_URLS).toContain("/offline");
    expect(sw.PRECACHE_URLS).toContain("/TaskSME.png");
  });
});

describe("shouldHandleFetch", () => {
  it("handles same-origin navigations", () => {
    const request = makeRequest({ mode: "navigate" });
    expect(
      sw.shouldHandleFetch(request, new URL(`${ORIGIN}/dashboard`), ORIGIN),
    ).toBe(true);
  });

  it("handles immutable build assets and precached files", () => {
    const request = makeRequest({});
    expect(
      sw.shouldHandleFetch(
        request,
        new URL(`${ORIGIN}/_next/static/chunks/main.js`),
        ORIGIN,
      ),
    ).toBe(true);
    expect(
      sw.shouldHandleFetch(request, new URL(`${ORIGIN}/TaskSME.png`), ORIGIN),
    ).toBe(true);
  });

  it("never intercepts non-GET requests", () => {
    const request = makeRequest({ method: "POST", mode: "navigate" });
    expect(
      sw.shouldHandleFetch(request, new URL(`${ORIGIN}/offline`), ORIGIN),
    ).toBe(false);
  });

  it("never intercepts cross-origin requests (e.g. the backend API)", () => {
    const request = makeRequest({});
    expect(
      sw.shouldHandleFetch(
        request,
        new URL(`${API_ORIGIN}/api/v1/workspaces`),
        ORIGIN,
      ),
    ).toBe(false);
  });

  it("never intercepts same-origin API or auth routes", () => {
    const request = makeRequest({ mode: "navigate" });
    expect(
      sw.shouldHandleFetch(request, new URL(`${ORIGIN}/api/v1/tasks`), ORIGIN),
    ).toBe(false);
    expect(
      sw.shouldHandleFetch(request, new URL(`${ORIGIN}/auth/refresh`), ORIGIN),
    ).toBe(false);
  });

  it("never intercepts requests carrying an Authorization header", () => {
    const request = makeRequest({
      headers: { Authorization: "Bearer token" },
    });
    expect(
      sw.shouldHandleFetch(request, new URL(`${ORIGIN}/TaskSME.png`), ORIGIN),
    ).toBe(false);
  });

  it("leaves other same-origin GET requests (workspace data) alone", () => {
    const request = makeRequest({});
    expect(
      sw.shouldHandleFetch(
        request,
        new URL(`${ORIGIN}/dashboard/data`),
        ORIGIN,
      ),
    ).toBe(false);
  });
});

describe("isCacheableStaticAsset", () => {
  it("accepts only build output and the precache list", () => {
    expect(
      sw.isCacheableStaticAsset(new URL(`${ORIGIN}/_next/static/css/app.css`)),
    ).toBe(true);
    expect(sw.isCacheableStaticAsset(new URL(`${ORIGIN}/offline`))).toBe(true);
    expect(sw.isCacheableStaticAsset(new URL(`${ORIGIN}/dashboard`))).toBe(
      false,
    );
    expect(
      sw.isCacheableStaticAsset(new URL(`${ORIGIN}/api/v1/tasks`)),
    ).toBe(false);
  });
});

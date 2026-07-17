/*
 * Task SME service worker.
 *
 * Caching policy (intentionally conservative):
 * - Precaches a small, versioned set of static assets (offline page, brand
 *   assets) at install time.
 * - Navigations are network-first and are NEVER cached; when the network is
 *   unavailable the precached /offline page is served instead.
 * - Only same-origin GET requests for immutable build output (/_next/static/)
 *   and the precache list are ever written to the cache.
 * - API requests, auth endpoints, authorized requests, and non-GET requests
 *   are never intercepted and never cached. Cookies never reach the cache
 *   because responses to navigations and API calls are not stored.
 * - On activation, caches from previous versions are deleted.
 */

const SW_VERSION = "v1";
const STATIC_CACHE = "tasksme-static-" + SW_VERSION;
const OFFLINE_URL = "/offline";

const PRECACHE_URLS = [OFFLINE_URL, "/TaskSME.png", "/favicon.ico"];

/** True when the request targets the backend API or an auth endpoint. */
function isApiOrAuthRequest(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname === "/api" ||
    url.pathname.startsWith("/auth/") ||
    url.pathname === "/auth"
  );
}

/** True for immutable build assets and explicitly precached URLs. */
function isCacheableStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    PRECACHE_URLS.includes(url.pathname)
  );
}

/**
 * Decides whether the service worker should intercept a request at all.
 * Anything not explicitly handled falls through to the network untouched.
 */
function shouldHandleFetch(request, url, origin) {
  if (request.method !== "GET") {
    return false;
  }
  if (url.origin !== origin) {
    return false;
  }
  if (isApiOrAuthRequest(url)) {
    return false;
  }
  if (request.headers && request.headers.get("authorization")) {
    return false;
  }
  return request.mode === "navigate" || isCacheableStaticAsset(url);
}

/** Network-first for navigations; responses are never cached. */
async function handleNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    const offlinePage = await cache.match(OFFLINE_URL);
    if (offlinePage) {
      return offlinePage;
    }
    return new Response(
      "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>Offline</title></head>" +
        "<body><h1>You are offline</h1><p>Check your connection and try again.</p></body></html>",
      {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }
}

/** Cache-first for versioned static assets. */
async function handleStaticAsset(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    cache.put(request, response.clone());
  }
  return response;
}

async function precacheStaticAssets() {
  const cache = await caches.open(STATIC_CACHE);
  await cache.addAll(PRECACHE_URLS);
}

async function cleanupOldCaches() {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith("tasksme-") && key !== STATIC_CACHE)
      .map((key) => caches.delete(key)),
  );
}

// Exposed for unit tests; harmless at runtime.
const swInternals = {
  SW_VERSION,
  STATIC_CACHE,
  OFFLINE_URL,
  PRECACHE_URLS,
  isApiOrAuthRequest,
  isCacheableStaticAsset,
  shouldHandleFetch,
};

if (typeof self !== "undefined") {
  self.__TASKSME_SW__ = swInternals;
}

if (typeof self !== "undefined" && typeof self.addEventListener === "function") {
  self.addEventListener("install", (event) => {
    event.waitUntil(precacheStaticAssets());
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(
      cleanupOldCaches().then(() => self.clients.claim()),
    );
  });

  self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") {
      self.skipWaiting();
    }
  });

  self.addEventListener("fetch", (event) => {
    const request = event.request;

    let url;
    try {
      url = new URL(request.url);
    } catch {
      return;
    }

    if (!shouldHandleFetch(request, url, self.location.origin)) {
      return;
    }

    if (request.mode === "navigate") {
      event.respondWith(handleNavigation(request));
      return;
    }

    event.respondWith(handleStaticAsset(request));
  });
}

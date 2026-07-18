import { describe, expect, it } from "vitest";
import type { ApiEnvelope } from "./client";
import { buildQueryString } from "./query";
import { isRouteNotFound, toServiceResult, withRouteFallback } from "./service";

const ok = <T,>(data: T): ApiEnvelope<T> => ({ success: true, data });
const routeMissing: ApiEnvelope<never> = {
  success: false,
  error: { code: "NOT_FOUND", message: "Route GET /tasks not found" },
};
const resourceMissing: ApiEnvelope<never> = {
  success: false,
  error: { code: "NOT_FOUND", message: "Resource not found" },
};

describe("buildQueryString", () => {
  it("serializes values and skips empties", () => {
    expect(
      buildQueryString({ a: "1", b: null, c: undefined, d: "", e: 0, f: false }),
    ).toBe("?a=1&e=0&f=false");
    expect(buildQueryString({})).toBe("");
  });
});

describe("isRouteNotFound", () => {
  it("distinguishes missing routes from missing resources", () => {
    expect(isRouteNotFound(routeMissing)).toBe(true);
    expect(isRouteNotFound(resourceMissing)).toBe(false);
  });
});

describe("withRouteFallback", () => {
  it("returns the primary result when it succeeds", async () => {
    const result = await withRouteFallback(
      async () => ok("primary"),
      async () => ok("fallback"),
    );
    expect(result).toEqual(ok("primary"));
  });

  it("falls back when the route is missing", async () => {
    const result = await withRouteFallback<string>(
      async () => routeMissing,
      async () => ok("fallback"),
    );
    expect(result).toEqual(ok("fallback"));
  });

  it("keeps the primary error when the fallback also fails", async () => {
    const result = await withRouteFallback<string>(
      async () => routeMissing,
      async () => resourceMissing,
    );
    expect(result).toEqual(routeMissing);
  });

  it("does not fall back on non-route errors", async () => {
    let fallbackCalled = false;
    const result = await withRouteFallback<string>(
      async () => resourceMissing,
      async () => {
        fallbackCalled = true;
        return ok("fallback");
      },
    );
    expect(result).toEqual(resourceMissing);
    expect(fallbackCalled).toBe(false);
  });
});

describe("toServiceResult", () => {
  it("maps success envelopes with meta", () => {
    const result = toServiceResult(
      { success: true, data: [1, 2], meta: { generatedAt: "x" } },
      (data) => (data as number[]).length,
    );
    expect(result).toEqual({
      ok: true,
      data: 2,
      meta: { generatedAt: "x" },
    });
  });

  it("maps error envelopes", () => {
    const result = toServiceResult(resourceMissing, () => 0);
    expect(result).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Resource not found",
    });
  });
});

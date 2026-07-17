import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAccessToken,
  get,
  getAccessToken,
  setAccessToken,
} from "./client";

describe("api client", () => {
  beforeEach(() => {
    clearAccessToken();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearAccessToken();
  });

  it("keeps access token only in memory", () => {
    setAccessToken("access-token");
    expect(getAccessToken()).toBe("access-token");
    clearAccessToken();
    expect(getAccessToken()).toBeNull();
  });

  it("injects bearer token and credentials on requests", async () => {
    setAccessToken("memory-token");

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ success: true, data: { ok: true } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await get<{ ok: boolean }>("/auth/me");
    expect(result.success).toBe(true);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/auth/me"),
      expect.objectContaining({
        credentials: "include",
        headers: expect.any(Headers),
      }),
    );

    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer memory-token");
  });

  it("single-flight refreshes on 401 then retries", async () => {
    setAccessToken("expired-token");

    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            error: { code: "UNAUTHORIZED", message: "expired" },
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { accessToken: "fresh-token" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: true, data: { email: "a@b.com" } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const result = await get<{ email: string }>("/auth/me");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("a@b.com");
    }

    expect(getAccessToken()).toBe("fresh-token");
    expect(fetch).toHaveBeenCalledTimes(3);

    const retryInit = vi.mocked(fetch).mock.calls[2][1] as RequestInit;
    const retryHeaders = retryInit.headers as Headers;
    expect(retryHeaders.get("Authorization")).toBe("Bearer fresh-token");
  });
});

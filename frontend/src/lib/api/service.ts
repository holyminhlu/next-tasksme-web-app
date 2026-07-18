import type { ApiEnvelope, ApiErrorEnvelope } from "./client";

/**
 * Normalized result returned by feature services: either mapped data (plus
 * the raw envelope meta) or a { code, message } error safe to render.
 */
export type ServiceResult<T> =
  | { ok: true; data: T; meta?: Record<string, unknown> }
  | { ok: false; code: string; message: string };

export function toServiceResult<Raw, T>(
  envelope: ApiEnvelope<Raw>,
  mapData: (data: Raw, meta?: unknown) => T,
): ServiceResult<T> {
  if (!envelope.success) {
    return {
      ok: false,
      code: envelope.error.code,
      message: envelope.error.message,
    };
  }

  return {
    ok: true,
    data: mapData(envelope.data, envelope.meta),
    meta: envelope.meta,
  };
}

export const MAPPING_ERROR = {
  ok: false as const,
  code: "UNEXPECTED_RESPONSE",
  message: "The server returned data in an unexpected shape.",
};

/**
 * Some Phase 4 contract routes are written unscoped (e.g. `POST /tasks`)
 * while the rest of the API is workspace-scoped. To stay compatible with
 * either mounting, try the contract path first and fall back to the
 * alternative only when the route itself is missing (the backend's global
 * 404 handler responds NOT_FOUND with a "Route ... not found" message).
 */
export function isRouteNotFound(envelope: ApiErrorEnvelope): boolean {
  return (
    envelope.error.code === "NOT_FOUND" &&
    /route/i.test(envelope.error.message ?? "")
  );
}

export async function withRouteFallback<T>(
  primary: () => Promise<ApiEnvelope<T>>,
  fallback: () => Promise<ApiEnvelope<T>>,
): Promise<ApiEnvelope<T>> {
  const result = await primary();

  if (!result.success && isRouteNotFound(result)) {
    const fallbackResult = await fallback();
    return fallbackResult.success ? fallbackResult : result;
  }

  return result;
}

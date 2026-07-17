import type { HealthResponse } from "./health.types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function getHealthStatus(
  signal?: AbortSignal,
): Promise<HealthResponse> {
  const response = await fetch(`${API_URL}/api/health`, { signal });
  const data = (await response.json()) as HealthResponse;

  if (!response.ok && response.status !== 503) {
    throw new Error(`Health API returned status ${response.status}`);
  }

  return data;
}

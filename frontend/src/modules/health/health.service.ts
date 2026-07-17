export type HealthLiveResponse = {
  status: "ok";
  service: string;
  timestamp: string;
};

export type HealthReadyResponse = {
  status: "ok" | "degraded";
  service: string;
  timestamp: string;
  checks: {
    database: {
      status: "up" | "down";
      latencyMs: number;
    };
  };
};

export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  meta?: {
    requestId?: string;
  };
};

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { signal });
  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok && response.status !== 503) {
    throw new Error(`API ${path} returned status ${response.status}`);
  }

  return payload.data;
}

export function getLiveStatus(signal?: AbortSignal) {
  return getJson<HealthLiveResponse>("/api/v1/health/live", signal);
}

export function getReadyStatus(signal?: AbortSignal) {
  return getJson<HealthReadyResponse>("/api/v1/health/ready", signal);
}

export function getSwaggerUrl() {
  return `${API_URL}/api/docs`;
}

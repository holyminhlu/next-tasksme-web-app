export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
};

export type ApiSuccessEnvelope<T> = {
  success: true;
  data: T;
  meta?: {
    requestId?: string;
    [key: string]: unknown;
  };
};

export type ApiErrorEnvelope = {
  success: false;
  error: ApiError;
};

export type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const API_PREFIX = "/api/v1";

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function clearAccessToken(): void {
  accessToken = null;
}

async function parseEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  const payload = (await response.json()) as ApiEnvelope<T>;
  return payload;
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const envelope = await parseEnvelope<{ accessToken: string }>(response);

      if (!envelope.success) {
        clearAccessToken();
        return null;
      }

      setAccessToken(envelope.data.accessToken);
      return envelope.data.accessToken;
    } catch {
      clearAccessToken();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  skipAuth?: boolean;
  skipRefresh?: boolean;
};

async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<ApiEnvelope<T>> {
  const { body, skipAuth = false, skipRefresh = false, headers, ...rest } =
    options;

  const requestHeaders = new Headers(headers);

  if (body !== undefined && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (!skipAuth && accessToken) {
    requestHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${API_PREFIX}${path}`, {
    ...rest,
    method,
    credentials: "include",
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let envelope = await parseEnvelope<T>(response);

  if (
    response.status === 401 &&
    !skipAuth &&
    !skipRefresh &&
    !path.startsWith("/auth/refresh")
  ) {
    const newToken = await refreshAccessToken();

    if (newToken) {
      requestHeaders.set("Authorization", `Bearer ${newToken}`);

      const retryResponse = await fetch(`${API_BASE_URL}${API_PREFIX}${path}`, {
        ...rest,
        method,
        credentials: "include",
        headers: requestHeaders,
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      envelope = await parseEnvelope<T>(retryResponse);
    }
  }

  return envelope;
}

export function get<T>(path: string, options?: Omit<RequestOptions, "body">) {
  return request<T>("GET", path, options);
}

export function post<T>(
  path: string,
  body?: unknown,
  options?: Omit<RequestOptions, "body">,
) {
  return request<T>("POST", path, { ...options, body });
}

export function patch<T>(
  path: string,
  body?: unknown,
  options?: Omit<RequestOptions, "body">,
) {
  return request<T>("PATCH", path, { ...options, body });
}

export function del<T>(path: string, options?: Omit<RequestOptions, "body">) {
  return request<T>("DELETE", path, options);
}

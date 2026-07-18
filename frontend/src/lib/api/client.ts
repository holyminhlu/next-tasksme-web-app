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

export function put<T>(
  path: string,
  body?: unknown,
  options?: Omit<RequestOptions, "body">,
) {
  return request<T>("PUT", path, { ...options, body });
}

export function del<T>(path: string, options?: Omit<RequestOptions, "body">) {
  return request<T>("DELETE", path, options);
}

export type BlobDownloadResult = {
  ok: true;
  blob: Blob;
  filename: string | null;
  contentType: string | null;
  headers: Headers;
} | {
  ok: false;
  code: string;
  message: string;
  status: number;
};

function parseFilenameFromDisposition(header: string | null): string | null {
  if (!header) {
    return null;
  }

  const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].trim());
    } catch {
      return utfMatch[1].trim();
    }
  }

  const plainMatch = /filename="?([^";]+)"?/i.exec(header);
  return plainMatch?.[1]?.trim() ?? null;
}

/**
 * POST that expects a binary body (CSV/XLSX export). On JSON error envelopes
 * returns `{ ok: false }`; on success returns the Blob + Content-Disposition.
 */
export async function postBlob(
  path: string,
  body?: unknown,
  options: Omit<RequestOptions, "body"> = {},
): Promise<BlobDownloadResult> {
  const { skipAuth = false, skipRefresh = false, headers, ...rest } = options;
  const requestHeaders = new Headers(headers);

  if (body !== undefined && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (!skipAuth && accessToken) {
    requestHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  const doFetch = async () =>
    fetch(`${API_BASE_URL}${API_PREFIX}${path}`, {
      ...rest,
      method: "POST",
      credentials: "include",
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  let response = await doFetch();

  if (
    response.status === 401 &&
    !skipAuth &&
    !skipRefresh &&
    !path.startsWith("/auth/refresh")
  ) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      requestHeaders.set("Authorization", `Bearer ${newToken}`);
      response = await doFetch();
    }
  }

  const contentType = response.headers.get("Content-Type");

  if (!response.ok) {
    try {
      const envelope = (await response.json()) as ApiErrorEnvelope;
      if (envelope && envelope.success === false && envelope.error) {
        return {
          ok: false,
          code: envelope.error.code,
          message: envelope.error.message,
          status: response.status,
        };
      }
    } catch {
      // fall through
    }

    return {
      ok: false,
      code: "REQUEST_FAILED",
      message: `Export failed (${response.status})`,
      status: response.status,
    };
  }

  const blob = await response.blob();
  return {
    ok: true,
    blob,
    filename: parseFilenameFromDisposition(
      response.headers.get("Content-Disposition"),
    ),
    contentType,
    headers: response.headers,
  };
}

/** Triggers a browser download for a Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** POST multipart/form-data (file uploads). Do not set Content-Type manually. */
export async function postFormData<T>(
  path: string,
  formData: FormData,
  options: Omit<RequestOptions, "body"> = {},
): Promise<ApiEnvelope<T>> {
  const { skipAuth = false, skipRefresh = false, headers, ...rest } = options;
  const requestHeaders = new Headers(headers);

  if (!skipAuth && accessToken) {
    requestHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  const doFetch = async () =>
    fetch(`${API_BASE_URL}${API_PREFIX}${path}`, {
      ...rest,
      method: "POST",
      credentials: "include",
      headers: requestHeaders,
      body: formData,
    });

  let response = await doFetch();

  if (
    response.status === 401 &&
    !skipAuth &&
    !skipRefresh &&
    !path.startsWith("/auth/refresh")
  ) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      requestHeaders.set("Authorization", `Bearer ${newToken}`);
      response = await doFetch();
    }
  }

  return parseEnvelope<T>(response);
}

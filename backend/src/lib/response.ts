import type { Response } from "express";

export type ApiSuccessMeta = {
  requestId?: string;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  [key: string]: unknown;
};

export function sendSuccess<T>(
  res: Response,
  data: T,
  options?: {
    statusCode?: number;
    meta?: ApiSuccessMeta;
  },
) {
  const requestId = res.getHeader("x-request-id");

  return res.status(options?.statusCode ?? 200).json({
    success: true,
    data,
    meta: {
      requestId: typeof requestId === "string" ? requestId : undefined,
      ...options?.meta,
    },
  });
}

export function sendError(
  res: Response,
  options: {
    statusCode: number;
    code: string;
    message: string;
    details?: unknown;
  },
) {
  const requestId = res.getHeader("x-request-id");

  return res.status(options.statusCode).json({
    success: false,
    error: {
      code: options.code,
      message: options.message,
      details: options.details,
      requestId: typeof requestId === "string" ? requestId : undefined,
    },
  });
}

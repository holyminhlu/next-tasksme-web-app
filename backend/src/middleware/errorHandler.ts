import type { NextFunction, Request, Response } from "express";
import { Prisma } from "../../generated/prisma/client.js";
import { getEnv } from "../config/env.js";
import { logger } from "../config/logger.js";
import { AppError } from "../lib/errors.js";
import { sendError } from "../lib/response.js";

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, {
    statusCode: 404,
    code: "NOT_FOUND",
    message: `Route ${req.method} ${req.path} not found`,
  });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const env = getEnv();
  const requestId = req.requestId;

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId }, err.message);
    } else {
      logger.warn({ err, requestId, details: err.details }, err.message);
    }

    sendError(res, {
      statusCode: err.statusCode,
      code: err.code,
      message: err.message,
      details: err.details,
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      sendError(res, {
        statusCode: 409,
        code: "CONFLICT",
        message: "Resource already exists",
      });
      return;
    }

    if (err.code === "P2025") {
      sendError(res, {
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Resource not found",
      });
      return;
    }
  }

  logger.error({ err, requestId }, "Unhandled error");

  sendError(res, {
    statusCode: 500,
    code: "INTERNAL_ERROR",
    message: env.isProduction
      ? "Internal server error"
      : err instanceof Error
        ? err.message
        : "Internal server error",
  });
}

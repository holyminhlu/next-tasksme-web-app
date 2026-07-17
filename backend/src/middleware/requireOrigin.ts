import type { NextFunction, Request, Response } from "express";
import { getEnv } from "../config/env.js";
import { ForbiddenError } from "../lib/errors.js";

export function requireOrigin(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const env = getEnv();
  const origin = req.get("origin");
  const referer = req.get("referer");

  if (!origin && !referer) {
    // Allow same-origin/non-browser clients such as health checks and tests.
    next();
    return;
  }

  const allowed = env.CORS_ORIGINS.some((allowedOrigin) => {
    if (origin && origin === allowedOrigin) {
      return true;
    }

    return Boolean(referer && referer.startsWith(allowedOrigin));
  });

  if (!allowed) {
    next(new ForbiddenError("Origin not allowed"));
    return;
  }

  next();
}

import type { NextFunction, Request, Response } from "express";
import { sendSuccess } from "../../lib/response.js";
import { healthService } from "./health.service.js";

export async function live(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendSuccess(res, healthService.getLiveness());
  } catch (error) {
    next(error);
  }
}

export async function ready(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const readiness = await healthService.getReadiness();
    sendSuccess(res, readiness, {
      statusCode: readiness.status === "ok" ? 200 : 503,
    });
  } catch (error) {
    next(error);
  }
}

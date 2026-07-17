import type { NextFunction, Request, Response } from "express";
import { healthService } from "./health.service";

export async function healthCheck(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const health = await healthService.getStatus();
    res.status(health.status === "ok" ? 200 : 503).json(health);
  } catch (error) {
    next(error);
  }
}

import type { NextFunction, Request, Response } from "express";
import { ForbiddenError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/response.js";
import type {
  ActivityQuery,
  DashboardQuery,
  MyWorkQuery,
} from "./dashboard.schemas.js";
import { dashboardService } from "./dashboard.service.js";

function getParam(req: Request, key: string): string {
  const value = req.params[key];
  return Array.isArray(value) ? value[0]! : value!;
}

function requireActor(req: Request) {
  if (!req.user || !req.tenant) {
    throw new ForbiddenError("Tenant context is required");
  }
  return {
    userId: req.user.id,
    roleKey: req.tenant.roleKey,
  };
}

export async function getDashboardSummary(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await dashboardService.getSummary(
      getParam(req, "workspaceId"),
      requireActor(req),
      req.query as unknown as DashboardQuery,
    );
    sendSuccess(res, data, { meta: { generatedAt: data.generatedAt } });
  } catch (error) {
    next(error);
  }
}

export async function getDashboardMyWork(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await dashboardService.getMyWork(
      getParam(req, "workspaceId"),
      requireActor(req),
      req.query as unknown as MyWorkQuery,
    );
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

export async function getDashboardCharts(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await dashboardService.getCharts(
      getParam(req, "workspaceId"),
      requireActor(req),
      req.query as unknown as DashboardQuery,
    );
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

export async function getDashboardActivity(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await dashboardService.getActivity(
      getParam(req, "workspaceId"),
      requireActor(req),
      req.query as unknown as ActivityQuery,
    );
    sendSuccess(res, result.items, {
      meta: { pagination: result.pagination },
    });
  } catch (error) {
    next(error);
  }
}

import type { NextFunction, Request, Response } from "express";
import { ForbiddenError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/response.js";
import type {
  CreateMilestoneInput,
  ReorderMilestonesInput,
  UpdateMilestoneInput,
} from "./milestones.schemas.js";
import { milestonesService } from "./milestones.service.js";

function param(req: Request, key: string) {
  const value = req.params[key];
  return Array.isArray(value) ? value[0]! : value!;
}

function actor(req: Request) {
  if (!req.user || !req.tenant) throw new ForbiddenError("Tenant context is required");
  return { userId: req.user.id, roleKey: req.tenant.roleKey };
}

export async function listMilestones(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await milestonesService.list(
        param(req, "workspaceId"),
        param(req, "projectId"),
        actor(req),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function getMilestone(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await milestonesService.get(
        param(req, "workspaceId"),
        param(req, "projectId"),
        param(req, "milestoneId"),
        actor(req),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function createMilestone(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await milestonesService.create(
        param(req, "workspaceId"),
        param(req, "projectId"),
        actor(req),
        req.body as CreateMilestoneInput,
      ),
      { statusCode: 201 },
    );
  } catch (error) {
    next(error);
  }
}

export async function updateMilestone(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await milestonesService.update(
        param(req, "workspaceId"),
        param(req, "projectId"),
        param(req, "milestoneId"),
        actor(req),
        req.body as UpdateMilestoneInput,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function deleteMilestone(req: Request, res: Response, next: NextFunction) {
  try {
    await milestonesService.delete(
      param(req, "workspaceId"),
      param(req, "projectId"),
      param(req, "milestoneId"),
      actor(req),
    );
    sendSuccess(res, { deleted: true });
  } catch (error) {
    next(error);
  }
}

export async function reorderMilestones(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await milestonesService.reorder(
        param(req, "workspaceId"),
        param(req, "projectId"),
        actor(req),
        req.body as ReorderMilestonesInput,
      ),
    );
  } catch (error) {
    next(error);
  }
}

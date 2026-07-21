import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { tenantContext } from "../../middleware/tenantContext.js";
import { validateRequest } from "../../middleware/validate.js";
import {
  createMilestone,
  deleteMilestone,
  getMilestone,
  listMilestones,
  reorderMilestones,
  updateMilestone,
} from "./milestones.controller.js";
import {
  createMilestoneSchema,
  milestoneParamsSchema,
  projectMilestonesParamsSchema,
  reorderMilestonesSchema,
  updateMilestoneSchema,
} from "./milestones.schemas.js";

export const milestonesRouter = Router({ mergeParams: true });

milestonesRouter.use(authenticate);

milestonesRouter.get(
  "/",
  validateRequest({ params: projectMilestonesParamsSchema }),
  tenantContext,
  requirePermission("projects:read"),
  listMilestones,
);

milestonesRouter.post(
  "/",
  validateRequest({ params: projectMilestonesParamsSchema, body: createMilestoneSchema }),
  tenantContext,
  requirePermission("projects:update"),
  createMilestone,
);

milestonesRouter.put(
  "/reorder",
  validateRequest({
    params: projectMilestonesParamsSchema,
    body: reorderMilestonesSchema,
  }),
  tenantContext,
  requirePermission("projects:update"),
  reorderMilestones,
);

milestonesRouter.get(
  "/:milestoneId",
  validateRequest({ params: milestoneParamsSchema }),
  tenantContext,
  requirePermission("projects:read"),
  getMilestone,
);

milestonesRouter.patch(
  "/:milestoneId",
  validateRequest({ params: milestoneParamsSchema, body: updateMilestoneSchema }),
  tenantContext,
  requirePermission("projects:update"),
  updateMilestone,
);

milestonesRouter.delete(
  "/:milestoneId",
  validateRequest({ params: milestoneParamsSchema }),
  tenantContext,
  requirePermission("projects:update"),
  deleteMilestone,
);

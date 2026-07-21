import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { tenantContext } from "../../middleware/tenantContext.js";
import { validateRequest } from "../../middleware/validate.js";
import { projectParamsSchema } from "../projects/projects.schemas.js";
import {
  addWorkflowStage,
  createWorkflowDraft,
  deleteWorkflowStage,
  getProjectWorkflow,
  getWorkflowDraft,
  getWorkflowPublishPreview,
  reorderWorkflowStages,
  updateWorkflowStage,
  upsertWorkflowTransitions,
  validateWorkflowDraft,
} from "./workflows.controller.js";
import {
  createWorkflowStageSchema,
  deleteWorkflowStageQuerySchema,
  reorderWorkflowStagesSchema,
  updateWorkflowStageSchema,
  upsertWorkflowTransitionsSchema,
  workflowStageParamsSchema,
} from "./workflows.schemas.js";
import { z } from "zod";

const draftParamsSchema = projectParamsSchema.extend({
  workflowId: z.string().uuid(),
});

export const projectWorkflowRouter = Router({ mergeParams: true });

projectWorkflowRouter.use(authenticate);

projectWorkflowRouter.get(
  "/",
  validateRequest({ params: projectParamsSchema }),
  tenantContext,
  requirePermission("projects:read"),
  getProjectWorkflow,
);

projectWorkflowRouter.post(
  "/draft",
  validateRequest({ params: projectParamsSchema }),
  tenantContext,
  requirePermission("projects:update"),
  createWorkflowDraft,
);

projectWorkflowRouter.get(
  "/drafts/:workflowId",
  validateRequest({ params: draftParamsSchema }),
  tenantContext,
  requirePermission("projects:read"),
  getWorkflowDraft,
);

projectWorkflowRouter.get(
  "/drafts/:workflowId/publish-preview",
  validateRequest({ params: draftParamsSchema }),
  tenantContext,
  requirePermission("projects:update"),
  getWorkflowPublishPreview,
);

projectWorkflowRouter.post(
  "/drafts/:workflowId/validate",
  validateRequest({ params: draftParamsSchema }),
  tenantContext,
  requirePermission("projects:update"),
  validateWorkflowDraft,
);

projectWorkflowRouter.post(
  "/drafts/:workflowId/stages",
  validateRequest({ params: draftParamsSchema, body: createWorkflowStageSchema }),
  tenantContext,
  requirePermission("projects:update"),
  addWorkflowStage,
);

projectWorkflowRouter.patch(
  "/drafts/:workflowId/stages/:stageId",
  validateRequest({
    params: draftParamsSchema.extend({ stageId: workflowStageParamsSchema.shape.stageId }),
    body: updateWorkflowStageSchema,
  }),
  tenantContext,
  requirePermission("projects:update"),
  updateWorkflowStage,
);

projectWorkflowRouter.delete(
  "/drafts/:workflowId/stages/:stageId",
  validateRequest({
    params: draftParamsSchema.extend({ stageId: workflowStageParamsSchema.shape.stageId }),
    query: deleteWorkflowStageQuerySchema,
  }),
  tenantContext,
  requirePermission("projects:update"),
  deleteWorkflowStage,
);

projectWorkflowRouter.put(
  "/drafts/:workflowId/stages/reorder",
  validateRequest({ params: draftParamsSchema, body: reorderWorkflowStagesSchema }),
  tenantContext,
  requirePermission("projects:update"),
  reorderWorkflowStages,
);

projectWorkflowRouter.put(
  "/drafts/:workflowId/transitions",
  validateRequest({ params: draftParamsSchema, body: upsertWorkflowTransitionsSchema }),
  tenantContext,
  requirePermission("projects:update"),
  upsertWorkflowTransitions,
);

import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { tenantContext } from "../../middleware/tenantContext.js";
import { validateRequest } from "../../middleware/validate.js";
import {
  createChecklistItem,
  deleteChecklistItem,
  listChecklist,
  reorderChecklist,
  updateChecklistItem,
} from "./checklist.controller.js";
import {
  checklistItemParamsSchema,
  createChecklistItemSchema,
  reorderChecklistSchema,
  updateChecklistItemSchema,
  workspaceTaskParamsSchema,
} from "./checklist.schemas.js";

export const checklistRouter = Router({ mergeParams: true });

checklistRouter.use(authenticate);

checklistRouter.get(
  "/",
  validateRequest({ params: workspaceTaskParamsSchema }),
  tenantContext,
  requirePermission("checklist.manage"),
  listChecklist,
);

checklistRouter.post(
  "/",
  validateRequest({
    params: workspaceTaskParamsSchema,
    body: createChecklistItemSchema,
  }),
  tenantContext,
  requirePermission("checklist.manage"),
  createChecklistItem,
);

checklistRouter.post(
  "/reorder",
  validateRequest({
    params: workspaceTaskParamsSchema,
    body: reorderChecklistSchema,
  }),
  tenantContext,
  requirePermission("checklist.manage"),
  reorderChecklist,
);

checklistRouter.patch(
  "/:itemId",
  validateRequest({
    params: checklistItemParamsSchema,
    body: updateChecklistItemSchema,
  }),
  tenantContext,
  requirePermission("checklist.manage"),
  updateChecklistItem,
);

checklistRouter.delete(
  "/:itemId",
  validateRequest({ params: checklistItemParamsSchema }),
  tenantContext,
  requirePermission("checklist.manage"),
  deleteChecklistItem,
);

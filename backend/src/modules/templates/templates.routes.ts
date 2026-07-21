import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { tenantContext } from "../../middleware/tenantContext.js";
import { validateRequest } from "../../middleware/validate.js";
import {
  archiveTemplate,
  cloneTemplate,
  createTemplateVersion,
  createTemplate,
  duplicateTemplate,
  getCloneJob,
  getTemplate,
  listTemplateVersions,
  listTemplates,
  publishTemplate,
  retryCloneJob,
  updateTemplate,
  validateTemplate,
} from "./templates.controller.js";
import {
  cloneJobParamsSchema,
  cloneTemplateSchema,
  createTemplateSchema,
  listTemplatesQuerySchema,
  templateIdParamsSchema,
  updateTemplateSchema,
} from "./templates.schemas.js";
import { workspaceIdParamsSchema } from "../tasks/tasks.schemas.js";

export const templatesRouter = Router({ mergeParams: true });

templatesRouter.use(authenticate);

templatesRouter.get(
  "/",
  validateRequest({ params: workspaceIdParamsSchema, query: listTemplatesQuerySchema }),
  tenantContext,
  requirePermission("projects:read"),
  listTemplates,
);

templatesRouter.post(
  "/",
  validateRequest({ params: workspaceIdParamsSchema, body: createTemplateSchema }),
  tenantContext,
  requirePermission("projects:create"),
  createTemplate,
);

templatesRouter.get(
  "/clone-jobs/:cloneJobId",
  validateRequest({ params: cloneJobParamsSchema }),
  tenantContext,
  requirePermission("projects:read"),
  getCloneJob,
);

templatesRouter.post(
  "/clone-jobs/:cloneJobId/retry",
  validateRequest({ params: cloneJobParamsSchema }),
  tenantContext,
  requirePermission("projects:create"),
  retryCloneJob,
);

templatesRouter.get(
  "/:templateId",
  validateRequest({ params: templateIdParamsSchema }),
  tenantContext,
  requirePermission("projects:read"),
  getTemplate,
);

templatesRouter.patch(
  "/:templateId",
  validateRequest({ params: templateIdParamsSchema, body: updateTemplateSchema }),
  tenantContext,
  requirePermission("projects:update"),
  updateTemplate,
);

templatesRouter.post(
  "/:templateId/publish",
  validateRequest({ params: templateIdParamsSchema }),
  tenantContext,
  requirePermission("projects:update"),
  publishTemplate,
);

templatesRouter.post(
  "/:templateId/validate",
  validateRequest({ params: templateIdParamsSchema }),
  tenantContext,
  requirePermission("projects:update"),
  validateTemplate,
);

templatesRouter.post(
  "/:templateId/versions",
  validateRequest({ params: templateIdParamsSchema }),
  tenantContext,
  requirePermission("projects:update"),
  createTemplateVersion,
);

templatesRouter.get(
  "/:templateId/versions",
  validateRequest({ params: templateIdParamsSchema }),
  tenantContext,
  requirePermission("projects:read"),
  listTemplateVersions,
);

templatesRouter.post(
  "/:templateId/archive",
  validateRequest({ params: templateIdParamsSchema }),
  tenantContext,
  requirePermission("projects:update"),
  archiveTemplate,
);

templatesRouter.post(
  "/:templateId/duplicate",
  validateRequest({ params: templateIdParamsSchema }),
  tenantContext,
  requirePermission("projects:create"),
  duplicateTemplate,
);

templatesRouter.post(
  "/:templateId/clone",
  validateRequest({ params: templateIdParamsSchema, body: cloneTemplateSchema }),
  tenantContext,
  requirePermission("projects:create"),
  cloneTemplate,
);

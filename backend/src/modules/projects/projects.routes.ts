import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { tenantContext } from "../../middleware/tenantContext.js";
import { validateRequest } from "../../middleware/validate.js";
import { workspaceIdParamsSchema } from "../tasks/tasks.schemas.js";
import { createProject, listProjects } from "./projects.controller.js";
import { createProjectSchema } from "./projects.schemas.js";

export const projectsRouter = Router({ mergeParams: true });

projectsRouter.use(authenticate);

projectsRouter.get(
  "/",
  validateRequest({ params: workspaceIdParamsSchema }),
  tenantContext,
  requirePermission("projects:read"),
  listProjects,
);

projectsRouter.post(
  "/",
  validateRequest({
    params: workspaceIdParamsSchema,
    body: createProjectSchema,
  }),
  tenantContext,
  requirePermission("projects:create"),
  createProject,
);

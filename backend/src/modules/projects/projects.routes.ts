import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { tenantContext } from "../../middleware/tenantContext.js";
import { validateRequest } from "../../middleware/validate.js";
import { workspaceIdParamsSchema } from "../tasks/tasks.schemas.js";
import {
  createProject,
  getProject,
  listEligibleAssignees,
  listProjectMembers,
  listProjects,
  replaceProjectMembers,
  updateProjectVisibility,
} from "./projects.controller.js";
import {
  createProjectSchema,
  eligibleAssigneesQuerySchema,
  projectParamsSchema,
  replaceProjectMembersSchema,
  updateProjectVisibilitySchema,
} from "./projects.schemas.js";

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

projectsRouter.get(
  "/:projectId",
  validateRequest({ params: projectParamsSchema }),
  tenantContext,
  requirePermission("projects:read"),
  getProject,
);

projectsRouter.get(
  "/:projectId/members",
  validateRequest({ params: projectParamsSchema }),
  tenantContext,
  requirePermission("projects:read"),
  listProjectMembers,
);

projectsRouter.put(
  "/:projectId/members",
  validateRequest({ params: projectParamsSchema, body: replaceProjectMembersSchema }),
  tenantContext,
  requirePermission("projects:update"),
  replaceProjectMembers,
);

projectsRouter.patch(
  "/:projectId/visibility",
  validateRequest({
    params: projectParamsSchema,
    body: updateProjectVisibilitySchema,
  }),
  tenantContext,
  requirePermission("projects:update"),
  updateProjectVisibility,
);

projectsRouter.get(
  "/:projectId/eligible-assignees",
  validateRequest({
    params: projectParamsSchema,
    query: eligibleAssigneesQuerySchema,
  }),
  tenantContext,
  requirePermission("tasks:assign"),
  listEligibleAssignees,
);

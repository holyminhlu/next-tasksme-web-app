import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { tenantContext } from "../../middleware/tenantContext.js";
import { validateRequest } from "../../middleware/validate.js";
import { workspaceIdParamsSchema } from "../tasks/tasks.schemas.js";
import {
  addProjectMember,
  archiveProject,
  createProject,
  deleteProject,
  getProject,
  listEligibleAssignees,
  listProjectMembers,
  listProjects,
  publishProjectWorkflow,
  removeProjectMember,
  replaceProjectMembers,
  restoreProject,
  unarchiveProject,
  updateProject,
  updateProjectMember,
  updateProjectVisibility,
} from "./projects.controller.js";
import {
  addProjectMemberSchema,
  createProjectSchema,
  eligibleAssigneesQuerySchema,
  listProjectsQuerySchema,
  projectMemberParamsSchema,
  projectParamsSchema,
  publishProjectWorkflowSchema,
  replaceProjectMembersSchema,
  updateProjectMemberSchema,
  updateProjectSchema,
  updateProjectVisibilitySchema,
} from "./projects.schemas.js";
import { milestonesRouter } from "../milestones/milestones.routes.js";
import { projectWorkflowRouter } from "../workflows/workflows.routes.js";

export const projectsRouter = Router({ mergeParams: true });

projectsRouter.use(authenticate);

projectsRouter.get(
  "/",
  validateRequest({ params: workspaceIdParamsSchema, query: listProjectsQuerySchema }),
  tenantContext,
  requirePermission("projects:read"),
  listProjects,
);

projectsRouter.post(
  "/",
  validateRequest({ params: workspaceIdParamsSchema, body: createProjectSchema }),
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

projectsRouter.patch(
  "/:projectId",
  validateRequest({ params: projectParamsSchema, body: updateProjectSchema }),
  tenantContext,
  requirePermission("projects:update"),
  updateProject,
);

projectsRouter.post(
  "/:projectId/archive",
  validateRequest({ params: projectParamsSchema }),
  tenantContext,
  requirePermission("projects:update"),
  archiveProject,
);

projectsRouter.post(
  "/:projectId/unarchive",
  validateRequest({ params: projectParamsSchema }),
  tenantContext,
  requirePermission("projects:update"),
  unarchiveProject,
);

projectsRouter.delete(
  "/:projectId",
  validateRequest({ params: projectParamsSchema }),
  tenantContext,
  requirePermission("projects:delete"),
  deleteProject,
);

projectsRouter.post(
  "/:projectId/restore",
  validateRequest({ params: projectParamsSchema }),
  tenantContext,
  requirePermission("projects:delete"),
  restoreProject,
);

projectsRouter.get(
  "/:projectId/members",
  validateRequest({ params: projectParamsSchema }),
  tenantContext,
  requirePermission("projects:read"),
  listProjectMembers,
);

projectsRouter.post(
  "/:projectId/members",
  validateRequest({ params: projectParamsSchema, body: addProjectMemberSchema }),
  tenantContext,
  requirePermission("projects:update"),
  addProjectMember,
);

projectsRouter.put(
  "/:projectId/members",
  validateRequest({ params: projectParamsSchema, body: replaceProjectMembersSchema }),
  tenantContext,
  requirePermission("projects:update"),
  replaceProjectMembers,
);

projectsRouter.patch(
  "/:projectId/members/:memberUserId",
  validateRequest({ params: projectMemberParamsSchema, body: updateProjectMemberSchema }),
  tenantContext,
  requirePermission("projects:update"),
  updateProjectMember,
);

projectsRouter.delete(
  "/:projectId/members/:memberUserId",
  validateRequest({ params: projectMemberParamsSchema }),
  tenantContext,
  requirePermission("projects:update"),
  removeProjectMember,
);

projectsRouter.patch(
  "/:projectId/visibility",
  validateRequest({ params: projectParamsSchema, body: updateProjectVisibilitySchema }),
  tenantContext,
  requirePermission("projects:update"),
  updateProjectVisibility,
);

projectsRouter.post(
  "/:projectId/workflow/publish",
  validateRequest({ params: projectParamsSchema, body: publishProjectWorkflowSchema }),
  tenantContext,
  requirePermission("projects:update"),
  publishProjectWorkflow,
);

projectsRouter.use("/:projectId/workflow", projectWorkflowRouter);
projectsRouter.use("/:projectId/milestones", milestonesRouter);

projectsRouter.get(
  "/:projectId/eligible-assignees",
  validateRequest({ params: projectParamsSchema, query: eligibleAssigneesQuerySchema }),
  tenantContext,
  requirePermission("tasks:assign"),
  listEligibleAssignees,
);

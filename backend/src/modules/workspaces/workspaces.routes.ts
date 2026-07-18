import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { optionalAuthenticate } from "../../middleware/optionalAuthenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { tenantContext } from "../../middleware/tenantContext.js";
import { validateRequest } from "../../middleware/validate.js";
import { dashboardRouter } from "../dashboard/dashboard.routes.js";
import { projectsRouter } from "../projects/projects.routes.js";
import { tasksRouter } from "../tasks/tasks.routes.js";
import { notificationsRouter } from "../notifications/notifications.routes.js";
import {
  acceptInvitation,
  applyModulePreset,
  completeOnboarding,
  createFirstProject,
  createWorkspace,
  getOnboarding,
  getWorkspace,
  inspectInvitation,
  inviteMember,
  listMembers,
  listModules,
  removeMember,
  revokeInvitation,
  transferOwnership,
  updateMemberRole,
  updateModules,
  updateOnboarding,
  updateWorkspace,
} from "./workspaces.controller.js";
import {
  acceptInvitationSchema,
  applyModulePresetSchema,
  createFirstProjectSchema,
  createWorkspaceSchema,
  invitationIdParamsSchema,
  inviteMemberSchema,
  listMembersQuerySchema,
  memberIdParamsSchema,
  transferOwnershipSchema,
  updateMemberRoleSchema,
  updateModulesSchema,
  updateOnboardingSchema,
  updateWorkspaceSchema,
  workspaceIdParamsSchema,
} from "./workspaces.schemas.js";

export const workspacesRouter = Router();
export const invitationsRouter = Router();

invitationsRouter.get("/preview", inspectInvitation);
invitationsRouter.post(
  "/accept",
  optionalAuthenticate,
  validateRequest({ body: acceptInvitationSchema }),
  acceptInvitation,
);

workspacesRouter.use(authenticate);

workspacesRouter.post(
  "/",
  validateRequest({ body: createWorkspaceSchema }),
  createWorkspace,
);

workspacesRouter.get(
  "/:workspaceId",
  validateRequest({ params: workspaceIdParamsSchema }),
  tenantContext,
  requirePermission("workspace:read"),
  getWorkspace,
);

workspacesRouter.patch(
  "/:workspaceId",
  validateRequest({
    params: workspaceIdParamsSchema,
    body: updateWorkspaceSchema,
  }),
  tenantContext,
  requirePermission("workspace:update"),
  updateWorkspace,
);

workspacesRouter.get(
  "/:workspaceId/members",
  validateRequest({
    params: workspaceIdParamsSchema,
    query: listMembersQuerySchema,
  }),
  tenantContext,
  requirePermission("members:read"),
  listMembers,
);

workspacesRouter.post(
  "/:workspaceId/invitations",
  validateRequest({
    params: workspaceIdParamsSchema,
    body: inviteMemberSchema,
  }),
  tenantContext,
  requirePermission("members:invite"),
  inviteMember,
);

workspacesRouter.delete(
  "/:workspaceId/invitations/:invitationId",
  validateRequest({ params: invitationIdParamsSchema }),
  tenantContext,
  requirePermission("members:invite"),
  revokeInvitation,
);

workspacesRouter.patch(
  "/:workspaceId/members/:memberId",
  validateRequest({
    params: memberIdParamsSchema,
    body: updateMemberRoleSchema,
  }),
  tenantContext,
  requirePermission("members:update"),
  updateMemberRole,
);

workspacesRouter.delete(
  "/:workspaceId/members/:memberId",
  validateRequest({ params: memberIdParamsSchema }),
  tenantContext,
  requirePermission("members:remove"),
  removeMember,
);

workspacesRouter.post(
  "/:workspaceId/transfer-ownership",
  validateRequest({
    params: workspaceIdParamsSchema,
    body: transferOwnershipSchema,
  }),
  tenantContext,
  requirePermission("ownership:transfer"),
  transferOwnership,
);

workspacesRouter.get(
  "/:workspaceId/onboarding",
  validateRequest({ params: workspaceIdParamsSchema }),
  tenantContext,
  getOnboarding,
);

workspacesRouter.patch(
  "/:workspaceId/onboarding",
  validateRequest({
    params: workspaceIdParamsSchema,
    body: updateOnboardingSchema,
  }),
  tenantContext,
  updateOnboarding,
);

workspacesRouter.post(
  "/:workspaceId/onboarding/complete",
  validateRequest({ params: workspaceIdParamsSchema }),
  tenantContext,
  completeOnboarding,
);

workspacesRouter.get(
  "/:workspaceId/modules",
  validateRequest({ params: workspaceIdParamsSchema }),
  tenantContext,
  requirePermission("workspace:read"),
  listModules,
);

workspacesRouter.post(
  "/:workspaceId/modules/presets",
  validateRequest({
    params: workspaceIdParamsSchema,
    body: applyModulePresetSchema,
  }),
  tenantContext,
  requirePermission("modules:manage"),
  applyModulePreset,
);

workspacesRouter.patch(
  "/:workspaceId/modules",
  validateRequest({
    params: workspaceIdParamsSchema,
    body: updateModulesSchema,
  }),
  tenantContext,
  requirePermission("modules:manage"),
  updateModules,
);

workspacesRouter.post(
  "/:workspaceId/onboarding/first-project",
  validateRequest({
    params: workspaceIdParamsSchema,
    body: createFirstProjectSchema,
  }),
  tenantContext,
  requirePermission("projects:create"),
  createFirstProject,
);

workspacesRouter.use("/:workspaceId/tasks", tasksRouter);
workspacesRouter.use("/:workspaceId/projects", projectsRouter);
workspacesRouter.use("/:workspaceId/dashboard", dashboardRouter);
workspacesRouter.use("/:workspaceId/notifications", notificationsRouter);

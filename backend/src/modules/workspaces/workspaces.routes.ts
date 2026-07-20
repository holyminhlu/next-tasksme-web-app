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
import { savedViewsRouter } from "../saved-views/saved-views.routes.js";
import { checklistRouter } from "../checklist/checklist.routes.js";
import { tagsRouter, taskTagsRouter } from "../tags/tags.routes.js";
import {
  customFieldsRouter,
  taskCustomFieldsRouter,
} from "../custom-fields/custom-fields.routes.js";
import { commentsRouter } from "../comments/comments.routes.js";
import { attachmentsRouter } from "../attachments/attachments.routes.js";
import { dependenciesRouter } from "../dependencies/dependencies.routes.js";
import {
  taskTimeLogsRouter,
  workspaceTimerRouter,
} from "../time-logs/time-logs.routes.js";
import { taskHistoryRouter } from "../task-history/task-history.routes.js";
import { automationRunsRouter } from "../automation/automation-runs.routes.js";
import { businessCalendarsRouter } from "../business-calendars/business-calendars.routes.js";
import { recurrencesRouter } from "../recurrences/recurrences.routes.js";
import { riskRulesRouter, taskRiskRouter } from "../risk/risk.routes.js";
import {
  slaInstancesRouter,
  slaPoliciesRouter,
  taskSlaRouter,
} from "../sla/sla.routes.js";
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
workspacesRouter.use(
  "/:workspaceId/tasks/:taskId/checklist-items",
  checklistRouter,
);
workspacesRouter.use("/:workspaceId/tasks/:taskId/tags", taskTagsRouter);
workspacesRouter.use(
  "/:workspaceId/tasks/:taskId/custom-field-values",
  taskCustomFieldsRouter,
);
workspacesRouter.use("/:workspaceId/tasks/:taskId/comments", commentsRouter);
workspacesRouter.use(
  "/:workspaceId/tasks/:taskId/attachments",
  attachmentsRouter,
);
workspacesRouter.use(
  "/:workspaceId/tasks/:taskId/dependencies",
  dependenciesRouter,
);
workspacesRouter.use(
  "/:workspaceId/tasks/:taskId/time-logs",
  taskTimeLogsRouter,
);
workspacesRouter.use(
  "/:workspaceId/tasks/:taskId/status-history",
  taskHistoryRouter,
);
workspacesRouter.use("/:workspaceId/tasks/:taskId/recurrence", recurrencesRouter);
workspacesRouter.use("/:workspaceId/tasks/:taskId/risk", taskRiskRouter);
workspacesRouter.use("/:workspaceId/tasks/:taskId/sla", taskSlaRouter);
workspacesRouter.use("/:workspaceId/risk-rules", riskRulesRouter);
workspacesRouter.use("/:workspaceId/business-calendars", businessCalendarsRouter);
workspacesRouter.use("/:workspaceId/sla-policies", slaPoliciesRouter);
workspacesRouter.use("/:workspaceId/sla-instances", slaInstancesRouter);
workspacesRouter.use("/:workspaceId/automation-runs", automationRunsRouter);
workspacesRouter.use("/:workspaceId/timers", workspaceTimerRouter);
workspacesRouter.use("/:workspaceId/tags", tagsRouter);
workspacesRouter.use("/:workspaceId/custom-fields", customFieldsRouter);
workspacesRouter.use("/:workspaceId/projects", projectsRouter);
workspacesRouter.use("/:workspaceId/dashboard", dashboardRouter);
workspacesRouter.use("/:workspaceId/notifications", notificationsRouter);
workspacesRouter.use("/:workspaceId/saved-views", savedViewsRouter);

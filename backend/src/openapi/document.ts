import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  selectWorkspaceSchema,
  verifyEmailSchema,
} from "../modules/auth/auth.schemas.js";
import {
  acceptInvitationSchema,
  applyModulePresetSchema,
  createFirstProjectSchema,
  createWorkspaceSchema,
  inviteMemberSchema,
  listMembersQuerySchema,
  updateModulesSchema,
  updateOnboardingSchema,
  updateWorkspaceSchema,
  workspaceIdParamsSchema,
} from "../modules/workspaces/workspaces.schemas.js";
import {
  addProjectMemberSchema,
  createProjectSchema,
  eligibleAssigneesQuerySchema,
  listProjectsQuerySchema,
  projectMemberParamsSchema,
  projectParamsSchema,
  replaceProjectMembersSchema,
  updateProjectMemberSchema,
  updateProjectSchema,
  updateProjectVisibilitySchema,
} from "../modules/projects/projects.schemas.js";
import {
  assigneeMutationSchema,
  boardTasksQuerySchema,
  bulkDeleteSchema,
  bulkUpdateSchema,
  calendarTasksQuerySchema,
  createTaskSchema,
  deleteTaskQuerySchema,
  exportTasksSchema,
  listTasksQuerySchema,
  moveTaskSchema,
  parseTaskSchema,
  statusMutationSchema,
  taskActivityQuerySchema,
  taskIdParamsSchema,
  taskStatusSchema,
  timelineTasksQuerySchema,
  updateTaskSchema,
  versionMutationSchema,
} from "../modules/tasks/tasks.schemas.js";
import {
  listNotificationsQuerySchema,
  notificationParamsSchema,
  updateNotificationPreferenceSchema,
} from "../modules/notifications/notifications.schemas.js";
import {
  createSavedViewSchema,
  savedViewIdParamsSchema,
  updateSavedViewSchema,
} from "../modules/saved-views/saved-views.schemas.js";
import {
  activityQuerySchema,
  dashboardQuerySchema,
  myWorkQuerySchema,
} from "../modules/dashboard/dashboard.schemas.js";
import {
  checklistItemParamsSchema,
  createChecklistItemSchema,
  reorderChecklistSchema,
  updateChecklistItemSchema,
  workspaceTaskParamsSchema,
} from "../modules/checklist/checklist.schemas.js";
import {
  createTagSchema,
  listTagsQuerySchema,
  setTaskTagsSchema,
  tagIdParamsSchema,
  updateTagSchema,
} from "../modules/tags/tags.schemas.js";
import {
  createCustomFieldSchema,
  fieldIdParamsSchema,
  listCustomFieldsQuerySchema,
  setTaskCustomFieldValuesSchema,
  updateCustomFieldSchema,
} from "../modules/custom-fields/custom-fields.schemas.js";
import {
  commentParamsSchema,
  createCommentSchema,
  listCommentsQuerySchema,
  updateCommentSchema,
} from "../modules/comments/comments.schemas.js";
import { attachmentParamsSchema } from "../modules/attachments/attachments.schemas.js";
import {
  createDependencySchema,
  dependencyParamsSchema,
  dependencyTaskParamsSchema,
} from "../modules/dependencies/dependencies.schemas.js";
import {
  createManualTimeLogSchema,
  listTimeLogsQuerySchema,
  startTimerSchema,
  stopTimerSchema,
  timeLogParamsSchema,
  timeLogTaskParamsSchema,
  updateTimeLogSchema,
  workspaceTimerParamsSchema,
} from "../modules/time-logs/time-logs.schemas.js";
import { taskHistoryParamsSchema } from "../modules/task-history/task-history.schemas.js";
import {
  createWorkflowStageSchema,
  deleteWorkflowStageQuerySchema,
  reorderWorkflowStagesSchema,
  updateWorkflowStageSchema,
  upsertWorkflowTransitionsSchema,
} from "../modules/workflows/workflows.schemas.js";
import {
  cloneJobParamsSchema,
  listTemplatesQuerySchema,
  templateIdParamsSchema,
} from "../modules/templates/templates.schemas.js";
import {
  milestoneParamsSchema,
  projectMilestonesParamsSchema,
} from "../modules/milestones/milestones.schemas.js";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

function jsonBody(schema: z.ZodTypeAny) {
  return {
    body: {
      content: {
        "application/json": {
          schema,
        },
      },
    },
  };
}

const authPaths: Array<{
  method: "get" | "post" | "delete" | "patch";
  path: string;
  tag: string;
  schema?: z.ZodTypeAny;
  security?: boolean;
}> = [
  { method: "post", path: "/api/v1/auth/register", tag: "Auth", schema: registerSchema },
  { method: "post", path: "/api/v1/auth/login", tag: "Auth", schema: loginSchema },
  { method: "post", path: "/api/v1/auth/refresh", tag: "Auth" },
  { method: "post", path: "/api/v1/auth/logout", tag: "Auth" },
  { method: "post", path: "/api/v1/auth/logout-all", tag: "Auth", security: true },
  {
    method: "post",
    path: "/api/v1/auth/verify-email",
    tag: "Auth",
    schema: verifyEmailSchema,
  },
  {
    method: "post",
    path: "/api/v1/auth/resend-verification",
    tag: "Auth",
    schema: resendVerificationSchema,
  },
  {
    method: "post",
    path: "/api/v1/auth/forgot-password",
    tag: "Auth",
    schema: forgotPasswordSchema,
  },
  {
    method: "post",
    path: "/api/v1/auth/reset-password",
    tag: "Auth",
    schema: resetPasswordSchema,
  },
  {
    method: "post",
    path: "/api/v1/auth/change-password",
    tag: "Auth",
    schema: changePasswordSchema,
    security: true,
  },
  { method: "get", path: "/api/v1/auth/me", tag: "Auth", security: true },
  { method: "get", path: "/api/v1/auth/sessions", tag: "Auth", security: true },
  {
    method: "delete",
    path: "/api/v1/auth/sessions/{sessionId}",
    tag: "Auth",
    security: true,
  },
  {
    method: "post",
    path: "/api/v1/auth/select-workspace",
    tag: "Auth",
    schema: selectWorkspaceSchema,
    security: true,
  },
  { method: "get", path: "/api/v1/me/workspaces", tag: "Auth", security: true },
];

for (const item of authPaths) {
  registry.registerPath({
    method: item.method,
    path: item.path,
    tags: [item.tag],
    security: item.security ? [{ bearerAuth: [] }] : undefined,
    request: item.schema ? jsonBody(item.schema) : undefined,
    responses: {
      200: { description: "Success" },
      201: { description: "Created" },
      400: { description: "Validation error" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
    },
  });
}

registry.registerPath({
  method: "get",
  path: "/api/v1/health/live",
  tags: ["Health"],
  responses: { 200: { description: "Liveness probe" } },
});

for (const mutation of [
  { path: "status", schema: statusMutationSchema, description: "Task status changed" },
  {
    path: "assignee",
    schema: assigneeMutationSchema,
    description: "Task assignee changed",
  },
  {
    path: "move",
    schema: moveTaskSchema,
    description: "Task moved on board (status + rank)",
  },
] as const) {
  registry.registerPath({
    method: "patch",
    path: `/api/v1/workspaces/{workspaceId}/tasks/{taskId}/${mutation.path}`,
    tags: ["Tasks"],
    security: [{ bearerAuth: [] }],
    request: { params: taskIdParamsSchema, ...jsonBody(mutation.schema) },
    responses: {
      200: { description: mutation.description },
      409: { description: "Stale task version" },
    },
  });
}

registry.registerPath({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/tasks/board",
  tags: ["Tasks"],
  security: [{ bearerAuth: [] }],
  request: { params: workspaceIdParamsSchema, query: boardTasksQuerySchema },
  responses: { 200: { description: "Kanban column tasks ordered by rank" } },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/tasks/calendar",
  tags: ["Tasks"],
  security: [{ bearerAuth: [] }],
  request: { params: workspaceIdParamsSchema, query: calendarTasksQuerySchema },
  responses: { 200: { description: "Calendar range tasks (timezone-aware)" } },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/tasks/timeline",
  tags: ["Tasks"],
  security: [{ bearerAuth: [] }],
  request: { params: workspaceIdParamsSchema, query: timelineTasksQuerySchema },
  responses: { 200: { description: "Timeline groups (not Full Gantt)" } },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/workspaces/{workspaceId}/tasks/export",
  tags: ["Tasks"],
  security: [{ bearerAuth: [] }],
  request: { params: workspaceIdParamsSchema, ...jsonBody(exportTasksSchema) },
  responses: {
    200: { description: "Synchronous CSV/XLSX export download" },
    400: { description: "Validation or row-limit error" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/saved-views",
  tags: ["Saved Views"],
  security: [{ bearerAuth: [] }],
  request: { params: workspaceIdParamsSchema },
  responses: { 200: { description: "Private saved views for current user" } },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/workspaces/{workspaceId}/saved-views",
  tags: ["Saved Views"],
  security: [{ bearerAuth: [] }],
  request: { params: workspaceIdParamsSchema, ...jsonBody(createSavedViewSchema) },
  responses: { 201: { description: "Saved view created" } },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/saved-views/{viewId}",
  tags: ["Saved Views"],
  security: [{ bearerAuth: [] }],
  request: { params: savedViewIdParamsSchema },
  responses: { 200: { description: "Saved view details" } },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/workspaces/{workspaceId}/saved-views/{viewId}",
  tags: ["Saved Views"],
  security: [{ bearerAuth: [] }],
  request: {
    params: savedViewIdParamsSchema,
    ...jsonBody(updateSavedViewSchema),
  },
  responses: { 200: { description: "Saved view updated" } },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/workspaces/{workspaceId}/saved-views/{viewId}",
  tags: ["Saved Views"],
  security: [{ bearerAuth: [] }],
  request: { params: savedViewIdParamsSchema },
  responses: { 200: { description: "Saved view deleted" } },
});

for (const endpoint of [
  {
    method: "get" as const,
    path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/checklist-items",
    tag: "Checklist",
    params: workspaceTaskParamsSchema,
    query: undefined,
    body: undefined,
    description: "Checklist items and completion progress",
  },
  {
    method: "post" as const,
    path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/checklist-items",
    tag: "Checklist",
    params: workspaceTaskParamsSchema,
    query: undefined,
    body: createChecklistItemSchema,
    description: "Checklist item created",
  },
  {
    method: "patch" as const,
    path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/checklist-items/{itemId}",
    tag: "Checklist",
    params: checklistItemParamsSchema,
    query: undefined,
    body: updateChecklistItemSchema,
    description: "Checklist item updated or completed",
  },
  {
    method: "delete" as const,
    path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/checklist-items/{itemId}",
    tag: "Checklist",
    params: checklistItemParamsSchema,
    query: undefined,
    body: undefined,
    description: "Checklist item deleted",
  },
  {
    method: "post" as const,
    path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/checklist-items/reorder",
    tag: "Checklist",
    params: workspaceTaskParamsSchema,
    query: undefined,
    body: reorderChecklistSchema,
    description: "Checklist reordered",
  },
  {
    method: "get" as const,
    path: "/api/v1/workspaces/{workspaceId}/tags",
    tag: "Tags",
    params: workspaceIdParamsSchema,
    query: listTagsQuerySchema,
    body: undefined,
    description: "Workspace tags",
  },
  {
    method: "post" as const,
    path: "/api/v1/workspaces/{workspaceId}/tags",
    tag: "Tags",
    params: workspaceIdParamsSchema,
    query: undefined,
    body: createTagSchema,
    description: "Workspace tag created",
  },
  {
    method: "patch" as const,
    path: "/api/v1/workspaces/{workspaceId}/tags/{tagId}",
    tag: "Tags",
    params: tagIdParamsSchema,
    query: undefined,
    body: updateTagSchema,
    description: "Workspace tag updated",
  },
  {
    method: "delete" as const,
    path: "/api/v1/workspaces/{workspaceId}/tags/{tagId}",
    tag: "Tags",
    params: tagIdParamsSchema,
    query: undefined,
    body: undefined,
    description: "Tag deleted without deleting tasks",
  },
  {
    method: "get" as const,
    path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/tags",
    tag: "Tags",
    params: workspaceTaskParamsSchema,
    query: undefined,
    body: undefined,
    description: "Tags assigned to task",
  },
  {
    method: "put" as const,
    path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/tags",
    tag: "Tags",
    params: workspaceTaskParamsSchema,
    query: undefined,
    body: setTaskTagsSchema,
    description: "Task tags replaced",
  },
  {
    method: "get" as const,
    path: "/api/v1/workspaces/{workspaceId}/custom-fields",
    tag: "Custom Fields",
    params: workspaceIdParamsSchema,
    query: listCustomFieldsQuerySchema,
    body: undefined,
    description: "Custom field definitions",
  },
  {
    method: "post" as const,
    path: "/api/v1/workspaces/{workspaceId}/custom-fields",
    tag: "Custom Fields",
    params: workspaceIdParamsSchema,
    query: undefined,
    body: createCustomFieldSchema,
    description: "Custom field definition created",
  },
  {
    method: "patch" as const,
    path: "/api/v1/workspaces/{workspaceId}/custom-fields/{fieldId}",
    tag: "Custom Fields",
    params: fieldIdParamsSchema,
    query: undefined,
    body: updateCustomFieldSchema,
    description: "Custom field definition updated",
  },
  {
    method: "delete" as const,
    path: "/api/v1/workspaces/{workspaceId}/custom-fields/{fieldId}",
    tag: "Custom Fields",
    params: fieldIdParamsSchema,
    query: undefined,
    body: undefined,
    description: "Custom field definition deactivated",
  },
  {
    method: "get" as const,
    path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/custom-field-values",
    tag: "Custom Fields",
    params: workspaceTaskParamsSchema,
    query: undefined,
    body: undefined,
    description: "Task custom field values",
  },
  {
    method: "put" as const,
    path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/custom-field-values",
    tag: "Custom Fields",
    params: workspaceTaskParamsSchema,
    query: undefined,
    body: setTaskCustomFieldValuesSchema,
    description: "Task custom field values updated",
  },
  {
    method: "get" as const,
    path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/comments",
    tag: "Comments",
    params: workspaceTaskParamsSchema,
    query: listCommentsQuerySchema,
    body: undefined,
    description: "Task comment thread",
  },
  {
    method: "post" as const,
    path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/comments",
    tag: "Comments",
    params: workspaceTaskParamsSchema,
    query: undefined,
    body: createCommentSchema,
    description: "Comment persisted and broadcast",
  },
  {
    method: "patch" as const,
    path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/comments/{commentId}",
    tag: "Comments",
    params: commentParamsSchema,
    query: undefined,
    body: updateCommentSchema,
    description: "Own comment updated",
  },
  {
    method: "delete" as const,
    path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/comments/{commentId}",
    tag: "Comments",
    params: commentParamsSchema,
    query: undefined,
    body: undefined,
    description: "Comment soft-deleted",
  },
  {
    method: "get" as const,
    path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/attachments",
    tag: "Attachments",
    params: workspaceTaskParamsSchema,
    query: undefined,
    body: undefined,
    description: "Task attachments",
  },
  {
    method: "get" as const,
    path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/attachments/{attachmentId}/download",
    tag: "Attachments",
    params: attachmentParamsSchema,
    query: undefined,
    body: undefined,
    description: "Short-lived signed download URL",
  },
  {
    method: "delete" as const,
    path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/attachments/{attachmentId}",
    tag: "Attachments",
    params: attachmentParamsSchema,
    query: undefined,
    body: undefined,
    description: "Attachment soft-deleted",
  },
] as const) {
  registry.registerPath({
    method: endpoint.method,
    path: endpoint.path,
    tags: [endpoint.tag],
    security: [{ bearerAuth: [] }],
    request: {
      params: endpoint.params,
      ...(endpoint.query ? { query: endpoint.query } : {}),
      ...(endpoint.body ? jsonBody(endpoint.body) : {}),
    },
    responses: {
      200: { description: endpoint.description },
      201: { description: endpoint.description },
      400: { description: "Validation error" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
      404: { description: "Resource not found" },
    },
  });
}

registry.registerPath({
  method: "post",
  path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/attachments",
  tags: ["Attachments"],
  security: [{ bearerAuth: [] }],
  request: {
    params: workspaceTaskParamsSchema,
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({ file: z.any() }),
        },
      },
    },
  },
  responses: {
    201: { description: "Attachment uploaded and metadata persisted" },
    400: { description: "Invalid size or MIME type" },
    403: { description: "Forbidden" },
  },
});

for (const endpoint of [
  {
    method: "get" as const,
    path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/dependencies",
    tag: "Dependencies",
    params: dependencyTaskParamsSchema,
    query: undefined,
    body: undefined,
    description: "Waiting-on and blocking task dependencies",
  },
  {
    method: "post" as const,
    path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/dependencies",
    tag: "Dependencies",
    params: dependencyTaskParamsSchema,
    query: undefined,
    body: createDependencySchema,
    description: "Directed dependency created after cycle validation",
  },
  {
    method: "delete" as const,
    path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/dependencies/{dependencyId}",
    tag: "Dependencies",
    params: dependencyParamsSchema,
    query: undefined,
    body: undefined,
    description: "Task dependency removed",
  },
  {
    method: "get" as const,
    path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/time-logs",
    tag: "Time Tracking",
    params: timeLogTaskParamsSchema,
    query: listTimeLogsQuerySchema,
    body: undefined,
    description: "Own or team time logs and totals",
  },
  {
    method: "post" as const,
    path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/time-logs",
    tag: "Time Tracking",
    params: timeLogTaskParamsSchema,
    query: undefined,
    body: createManualTimeLogSchema,
    description: "Validated manual time log created",
  },
  {
    method: "post" as const,
    path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/time-logs/timer/start",
    tag: "Time Tracking",
    params: timeLogTaskParamsSchema,
    query: undefined,
    body: startTimerSchema,
    description: "Server-persisted workspace timer started",
  },
  {
    method: "post" as const,
    path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/time-logs/timer/stop",
    tag: "Time Tracking",
    params: timeLogTaskParamsSchema,
    query: undefined,
    body: stopTimerSchema,
    description: "Running timer stopped and duration calculated",
  },
  {
    method: "patch" as const,
    path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/time-logs/{timeLogId}",
    tag: "Time Tracking",
    params: timeLogParamsSchema,
    query: undefined,
    body: updateTimeLogSchema,
    description: "Time log updated after overlap validation",
  },
  {
    method: "delete" as const,
    path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/time-logs/{timeLogId}",
    tag: "Time Tracking",
    params: timeLogParamsSchema,
    query: undefined,
    body: undefined,
    description: "Authorized time log deleted",
  },
  {
    method: "get" as const,
    path: "/api/v1/workspaces/{workspaceId}/timers/running",
    tag: "Time Tracking",
    params: workspaceTimerParamsSchema,
    query: undefined,
    body: undefined,
    description: "Current user's running workspace timer",
  },
  {
    method: "get" as const,
    path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/status-history",
    tag: "Task History",
    params: taskHistoryParamsSchema,
    query: undefined,
    body: undefined,
    description: "Status timeline and duration aggregates",
  },
  {
    method: "get" as const,
    path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/recurrence",
    tag: "Recurrence",
    params: taskIdParamsSchema,
    query: undefined,
    body: undefined,
    description: "Task recurrence schedule or null",
  },
  {
    method: "put" as const,
    path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/recurrence",
    tag: "Recurrence",
    params: taskIdParamsSchema,
    query: undefined,
    body: undefined,
    description: "Create or update task recurrence",
  },
  {
    method: "get" as const,
    path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/risk",
    tag: "Risk",
    params: taskIdParamsSchema,
    query: undefined,
    body: undefined,
    description: "Task risk level, score, and reasons",
  },
  {
    method: "get" as const,
    path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/sla",
    tag: "SLA",
    params: taskIdParamsSchema,
    query: undefined,
    body: undefined,
    description: "Task SLA instances when SLA module is enabled",
  },
  {
    method: "get" as const,
    path: "/api/v1/workspaces/{workspaceId}/automation-runs",
    tag: "Automation",
    params: workspaceIdParamsSchema,
    query: undefined,
    body: undefined,
    description: "Automation run history with optional retry",
  },
] as const) {
  registry.registerPath({
    method: endpoint.method,
    path: endpoint.path,
    tags: [endpoint.tag],
    security: [{ bearerAuth: [] }],
    request: {
      params: endpoint.params,
      ...(endpoint.query ? { query: endpoint.query } : {}),
      ...(endpoint.body ? jsonBody(endpoint.body) : {}),
    },
    responses: {
      200: { description: endpoint.description },
      201: { description: endpoint.description },
      400: { description: "Validation error" },
      403: { description: "Forbidden" },
      404: { description: "Not found" },
      409: { description: "Dependency, timer, or overlap conflict" },
    },
  });
}

for (const lifecycle of ["archive", "unarchive", "restore"] as const) {
  registry.registerPath({
    method: "post",
    path: `/api/v1/workspaces/{workspaceId}/tasks/{taskId}/${lifecycle}`,
    tags: ["Tasks"],
    security: [{ bearerAuth: [] }],
    request: { params: taskIdParamsSchema, ...jsonBody(versionMutationSchema) },
    responses: {
      200: { description: `Task ${lifecycle}d` },
      409: { description: "Stale task version" },
    },
  });
}

registry.registerPath({
  method: "post",
  path: "/api/v1/workspaces/{workspaceId}/tasks/bulk-update",
  tags: ["Tasks"],
  security: [{ bearerAuth: [] }],
  request: { params: workspaceIdParamsSchema, ...jsonBody(bulkUpdateSchema) },
  responses: { 200: { description: "Per-item bulk update results" } },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/workspaces/{workspaceId}/tasks/bulk-delete",
  tags: ["Tasks"],
  security: [{ bearerAuth: [] }],
  request: { params: workspaceIdParamsSchema, ...jsonBody(bulkDeleteSchema) },
  responses: { 200: { description: "Per-item bulk delete results" } },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}/activity",
  tags: ["Tasks"],
  security: [{ bearerAuth: [] }],
  request: { params: taskIdParamsSchema, query: taskActivityQuerySchema },
  responses: { 200: { description: "Task activity history" } },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/notifications",
  tags: ["Notifications"],
  security: [{ bearerAuth: [] }],
  request: { params: workspaceIdParamsSchema, query: listNotificationsQuerySchema },
  responses: { 200: { description: "Current user's notifications" } },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/workspaces/{workspaceId}/notifications/{notificationId}/read",
  tags: ["Notifications"],
  security: [{ bearerAuth: [] }],
  request: { params: notificationParamsSchema },
  responses: { 200: { description: "Notification marked read" } },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/workspaces/{workspaceId}/notifications/read-all",
  tags: ["Notifications"],
  security: [{ bearerAuth: [] }],
  request: { params: workspaceIdParamsSchema },
  responses: {
    200: {
      description: "All unread notifications for the current user marked read",
    },
  },
});

for (const method of ["get", "patch"] as const) {
  registry.registerPath({
    method,
    path: "/api/v1/workspaces/{workspaceId}/notifications/preferences",
    tags: ["Notifications"],
    security: [{ bearerAuth: [] }],
    request: {
      params: workspaceIdParamsSchema,
      ...(method === "patch" ? jsonBody(updateNotificationPreferenceSchema) : {}),
    },
    responses: { 200: { description: "Current user's notification preferences" } },
  });
}

registry.registerPath({
  method: "get",
  path: "/api/v1/health/ready",
  tags: ["Health"],
  responses: {
    200: { description: "Readiness probe" },
    503: { description: "Dependencies unavailable" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/workspaces",
  tags: ["Workspaces"],
  security: [{ bearerAuth: [] }],
  request: jsonBody(createWorkspaceSchema),
  responses: { 201: { description: "Workspace created" } },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}",
  tags: ["Workspaces"],
  security: [{ bearerAuth: [] }],
  request: { params: workspaceIdParamsSchema },
  responses: { 200: { description: "Workspace details" } },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/workspaces/{workspaceId}",
  tags: ["Workspaces"],
  security: [{ bearerAuth: [] }],
  request: {
    params: workspaceIdParamsSchema,
    ...jsonBody(updateWorkspaceSchema),
  },
  responses: { 200: { description: "Workspace updated" } },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/members",
  tags: ["Workspaces"],
  security: [{ bearerAuth: [] }],
  request: {
    params: workspaceIdParamsSchema,
    query: listMembersQuerySchema,
  },
  responses: { 200: { description: "Workspace members" } },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/workspaces/{workspaceId}/invitations",
  tags: ["Workspaces"],
  security: [{ bearerAuth: [] }],
  request: {
    params: workspaceIdParamsSchema,
    ...jsonBody(inviteMemberSchema),
  },
  responses: { 201: { description: "Invitation created" } },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/onboarding",
  tags: ["Onboarding"],
  security: [{ bearerAuth: [] }],
  request: { params: workspaceIdParamsSchema },
  responses: { 200: { description: "Onboarding progress" } },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/workspaces/{workspaceId}/onboarding",
  tags: ["Onboarding"],
  security: [{ bearerAuth: [] }],
  request: {
    params: workspaceIdParamsSchema,
    ...jsonBody(updateOnboardingSchema),
  },
  responses: { 200: { description: "Onboarding updated" } },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/workspaces/{workspaceId}/onboarding/complete",
  tags: ["Onboarding"],
  security: [{ bearerAuth: [] }],
  request: { params: workspaceIdParamsSchema },
  responses: { 200: { description: "Onboarding completed" } },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/workspaces/{workspaceId}/onboarding/first-project",
  tags: ["Onboarding"],
  security: [{ bearerAuth: [] }],
  request: {
    params: workspaceIdParamsSchema,
    ...jsonBody(createFirstProjectSchema),
  },
  responses: { 201: { description: "First project created" } },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/modules",
  tags: ["Modules"],
  security: [{ bearerAuth: [] }],
  request: { params: workspaceIdParamsSchema },
  responses: { 200: { description: "Workspace modules" } },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/workspaces/{workspaceId}/modules/presets",
  tags: ["Modules"],
  security: [{ bearerAuth: [] }],
  request: {
    params: workspaceIdParamsSchema,
    ...jsonBody(applyModulePresetSchema),
  },
  responses: { 200: { description: "Module preset applied" } },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/workspaces/{workspaceId}/modules",
  tags: ["Modules"],
  security: [{ bearerAuth: [] }],
  request: {
    params: workspaceIdParamsSchema,
    ...jsonBody(updateModulesSchema),
  },
  responses: { 200: { description: "Modules updated" } },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/invitations/accept",
  tags: ["Invitations"],
  request: jsonBody(acceptInvitationSchema),
  responses: { 200: { description: "Invitation accepted" } },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/projects",
  tags: ["Projects"],
  security: [{ bearerAuth: [] }],
  request: {
    params: workspaceIdParamsSchema,
    query: listProjectsQuerySchema,
  },
  responses: { 200: { description: "Project list" } },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/workspaces/{workspaceId}/projects",
  tags: ["Projects"],
  security: [{ bearerAuth: [] }],
  request: {
    params: workspaceIdParamsSchema,
    ...jsonBody(createProjectSchema),
  },
  responses: { 201: { description: "Project created" } },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/projects/{projectId}",
  tags: ["Projects"],
  security: [{ bearerAuth: [] }],
  request: { params: projectParamsSchema },
  responses: { 200: { description: "Project details with creator and members" } },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/workspaces/{workspaceId}/projects/{projectId}",
  tags: ["Projects"],
  security: [{ bearerAuth: [] }],
  request: {
    params: projectParamsSchema,
    ...jsonBody(updateProjectSchema),
  },
  responses: { 200: { description: "Project updated" } },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/workspaces/{workspaceId}/projects/{projectId}/archive",
  tags: ["Projects"],
  security: [{ bearerAuth: [] }],
  request: { params: projectParamsSchema },
  responses: { 200: { description: "Project archived" } },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/workspaces/{workspaceId}/projects/{projectId}/unarchive",
  tags: ["Projects"],
  security: [{ bearerAuth: [] }],
  request: { params: projectParamsSchema },
  responses: { 200: { description: "Project unarchived" } },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/workspaces/{workspaceId}/projects/{projectId}",
  tags: ["Projects"],
  security: [{ bearerAuth: [] }],
  request: { params: projectParamsSchema },
  responses: { 200: { description: "Project moved to trash" } },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/workspaces/{workspaceId}/projects/{projectId}/restore",
  tags: ["Projects"],
  security: [{ bearerAuth: [] }],
  request: { params: projectParamsSchema },
  responses: { 200: { description: "Project restored from trash" } },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/projects/{projectId}/members",
  tags: ["Projects"],
  security: [{ bearerAuth: [] }],
  request: { params: projectParamsSchema },
  responses: { 200: { description: "Project member summaries" } },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/workspaces/{workspaceId}/projects/{projectId}/members",
  tags: ["Projects"],
  security: [{ bearerAuth: [] }],
  request: {
    params: projectParamsSchema,
    ...jsonBody(addProjectMemberSchema),
  },
  responses: { 200: { description: "Project member added" } },
});

registry.registerPath({
  method: "put",
  path: "/api/v1/workspaces/{workspaceId}/projects/{projectId}/members",
  tags: ["Projects"],
  security: [{ bearerAuth: [] }],
  request: {
    params: projectParamsSchema,
    ...jsonBody(replaceProjectMembersSchema),
  },
  responses: { 200: { description: "Project membership replaced" } },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/workspaces/{workspaceId}/projects/{projectId}/members/{memberUserId}",
  tags: ["Projects"],
  security: [{ bearerAuth: [] }],
  request: {
    params: projectMemberParamsSchema,
    ...jsonBody(updateProjectMemberSchema),
  },
  responses: { 200: { description: "Project member role updated" } },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/workspaces/{workspaceId}/projects/{projectId}/members/{memberUserId}",
  tags: ["Projects"],
  security: [{ bearerAuth: [] }],
  request: { params: projectMemberParamsSchema },
  responses: { 200: { description: "Project member removed" } },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/workspaces/{workspaceId}/projects/{projectId}/visibility",
  tags: ["Projects"],
  security: [{ bearerAuth: [] }],
  request: {
    params: projectParamsSchema,
    ...jsonBody(updateProjectVisibilitySchema),
  },
  responses: { 200: { description: "Project visibility updated" } },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/projects/{projectId}/eligible-assignees",
  tags: ["Projects"],
  security: [{ bearerAuth: [] }],
  request: {
    params: projectParamsSchema,
    query: eligibleAssigneesQuerySchema,
  },
  responses: { 200: { description: "Active eligible task assignees" } },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/tasks",
  tags: ["Tasks"],
  security: [{ bearerAuth: [] }],
  request: {
    params: workspaceIdParamsSchema,
    query: listTasksQuerySchema,
  },
  responses: { 200: { description: "Task list" } },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/workspaces/{workspaceId}/tasks",
  tags: ["Tasks"],
  operationId: "createTask",
  security: [{ bearerAuth: [] }],
  request: {
    params: workspaceIdParamsSchema,
    ...jsonBody(createTaskSchema),
  },
  responses: { 201: { description: "Task created (includes completedAt)" } },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}",
  tags: ["Tasks"],
  operationId: "updateTask",
  security: [{ bearerAuth: [] }],
  request: {
    params: taskIdParamsSchema,
    ...jsonBody(updateTaskSchema),
  },
  responses: {
    200: { description: "Task updated (includes completedAt)" },
    409: { description: "Stale task version" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}",
  tags: ["Tasks"],
  operationId: "getTask",
  security: [{ bearerAuth: [] }],
  request: {
    params: taskIdParamsSchema,
  },
  responses: {
    200: { description: "Task detail (includes completedAt)" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/workspaces/{workspaceId}/tasks/{taskId}",
  tags: ["Tasks"],
  operationId: "deleteTask",
  security: [{ bearerAuth: [] }],
  request: {
    params: taskIdParamsSchema,
    query: deleteTaskQuerySchema,
  },
  responses: {
    200: { description: "Task soft-deleted" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/workspaces/{workspaceId}/tasks/parse",
  tags: ["Tasks"],
  security: [{ bearerAuth: [] }],
  request: {
    params: workspaceIdParamsSchema,
    ...jsonBody(parseTaskSchema),
  },
  responses: { 200: { description: "Parsed task draft (no persistence)" } },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/dashboard/summary",
  tags: ["Dashboard"],
  security: [{ bearerAuth: [] }],
  request: {
    params: workspaceIdParamsSchema,
    query: dashboardQuerySchema,
  },
  responses: { 200: { description: "Dashboard summary stats" } },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/dashboard/my-work",
  tags: ["Dashboard"],
  security: [{ bearerAuth: [] }],
  request: {
    params: workspaceIdParamsSchema,
    query: myWorkQuerySchema,
  },
  responses: { 200: { description: "My work tasks" } },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/dashboard/charts",
  tags: ["Dashboard"],
  security: [{ bearerAuth: [] }],
  request: {
    params: workspaceIdParamsSchema,
    query: dashboardQuerySchema,
  },
  responses: { 200: { description: "Dashboard charts" } },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/dashboard/activity",
  tags: ["Dashboard"],
  security: [{ bearerAuth: [] }],
  request: {
    params: workspaceIdParamsSchema,
    query: activityQuerySchema,
  },
  responses: { 200: { description: "Activity feed (not audit logs)" } },
});

const uuidSchema = z.string().uuid();
const isoDateTimeSchema = z.string().datetime();
const workflowStageCategoryOpenApiSchema = z.enum([
  "BACKLOG",
  "NOT_STARTED",
  "IN_PROGRESS",
  "BLOCKED",
  "COMPLETED",
  "CANCELLED",
]);

const workflowConditionClauseOpenApiSchema = z.union([
  z.object({
    field: z.literal("task.assigneeId"),
    operator: z.enum(["isSet", "isNotSet"]),
  }),
  z.object({
    field: z.literal("task.priority"),
    operator: z.enum(["eq", "in"]),
    value: z.union([
      z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
      z
        .array(z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]))
        .min(1)
        .max(4),
    ]),
  }),
  z.object({
    field: z.enum([
      "task.isBlocked",
      "task.checklistComplete",
      "task.dependenciesComplete",
    ]),
    operator: z.literal("eq"),
    value: z.boolean(),
  }),
]);
const workflowConditionsOpenApiSchema = registry.register(
  "WorkflowConditions",
  z.union([
    z.object({}).strict(),
    z
      .object({
        version: z.literal(1),
        all: z.array(workflowConditionClauseOpenApiSchema).min(1).max(20),
      })
      .strict(),
  ]),
);
const workflowStageOpenApiSchema = registry.register(
  "WorkflowStage",
  z.object({
    id: uuidSchema,
    workflowId: uuidSchema,
    name: z.string(),
    category: workflowStageCategoryOpenApiSchema,
    color: z.string().nullable(),
    position: z.number().int(),
    isInitial: z.boolean(),
    isTerminal: z.boolean(),
    isActive: z.boolean(),
  }),
);
const workflowTransitionOpenApiSchema = registry.register(
  "WorkflowTransition",
  z.object({
    id: uuidSchema,
    workflowId: uuidSchema,
    fromStageId: uuidSchema,
    toStageId: uuidSchema,
    requiredPermission: z.string().nullable(),
    conditionsJson: workflowConditionsOpenApiSchema,
  }),
);
const workflowOpenApiSchema = registry.register(
  "Workflow",
  z.object({
    id: uuidSchema,
    familyId: uuidSchema,
    workspaceId: uuidSchema,
    sourceProjectId: uuidSchema.nullable(),
    name: z.string(),
    version: z.number().int().min(0),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
    stages: z.array(workflowStageOpenApiSchema),
    transitions: z.array(workflowTransitionOpenApiSchema),
  }),
);
const projectWorkflowStateOpenApiSchema = registry.register(
  "ProjectWorkflowState",
  z.object({
    published: workflowOpenApiSchema.nullable(),
    draft: workflowOpenApiSchema.nullable(),
    appliedVersion: z.number().int().nullable(),
  }),
);
const workflowPublishPreviewOpenApiSchema = registry.register(
  "WorkflowPublishPreview",
  z.object({
    taskCount: z.number().int().min(0),
    currentStages: z.array(
      z.object({ id: uuidSchema, name: z.string(), taskCount: z.number().int().min(0) }),
    ),
    legacyStatusCounts: z.array(
      z.object({ status: taskStatusSchema, count: z.number().int().min(0) }),
    ),
    requiredStageMappings: z.array(
      z.object({ id: uuidSchema, name: z.string(), taskCount: z.number().int().min(1) }),
    ),
    requiresMapping: z.boolean(),
  }),
);
const workflowPublishInputOpenApiSchema = registry.register(
  "WorkflowPublishInput",
  z.object({
    draftWorkflowId: uuidSchema,
    stageMappings: z
      .array(z.object({ fromStageId: uuidSchema, toStageId: uuidSchema }))
      .max(500)
      .default([]),
    legacyStatusMappings: z
      .array(z.object({ fromStatus: taskStatusSchema, toStageId: uuidSchema }))
      .max(50)
      .default([]),
  }),
);
const workflowPublishResultOpenApiSchema = registry.register(
  "WorkflowPublishResult",
  z.object({
    workflowId: uuidSchema,
    workflowVersion: z.number().int().min(1),
    movedTasks: z.number().int().min(0),
  }),
);
registry.register(
  "CreateWorkflowStageInput",
  z.object({
    name: z.string().min(1).max(80),
    category: workflowStageCategoryOpenApiSchema,
    color: z.string().max(32).optional(),
    isInitial: z.boolean().optional(),
    isTerminal: z.boolean().optional(),
  }),
);
registry.register(
  "UpdateWorkflowStageInput",
  z.object({
    name: z.string().min(1).max(80).optional(),
    category: workflowStageCategoryOpenApiSchema.optional(),
    color: z.string().max(32).nullable().optional(),
    isInitial: z.boolean().optional(),
    isTerminal: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }),
);
registry.register(
  "ReorderWorkflowStagesInput",
  z.object({ stageIds: z.array(uuidSchema).min(1).max(50) }),
);
registry.register(
  "ReplaceWorkflowTransitionsInput",
  z.object({
    transitions: z
      .array(
        z.object({
          fromStageId: uuidSchema,
          toStageId: uuidSchema,
          requiredPermission: z.string().max(120).nullable().optional(),
          conditionsJson: workflowConditionsOpenApiSchema.optional(),
        }),
      )
      .max(500),
  }),
);

const templateKeyOpenApiSchema = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
const templateOffsetOpenApiSchema = z.number().int().min(-3650).max(3650);
const templateContentOpenApiSchema = registry.register(
  "TemplateContentV2",
  z.object({
    schemaVersion: z.literal(2),
    project: z.object({
      description: z.string().max(5000).nullable().optional(),
      status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD"]),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
      visibility: z.enum(["WORKSPACE", "PRIVATE"]),
      completionPolicy: z.enum(["WARN_ONLY", "BLOCK", "BLOCK_WITH_OVERRIDE"]),
      managerPlaceholderKey: templateKeyOpenApiSchema.nullable().optional(),
    }),
    memberPlaceholders: z.array(
      z.object({
        key: templateKeyOpenApiSchema,
        name: z.string().min(1).max(120),
        projectRole: z.enum([
          "PROJECT_OWNER",
          "PROJECT_MANAGER",
          "PROJECT_MEMBER",
          "PROJECT_VIEWER",
        ]),
        required: z.boolean(),
      }),
    ),
    workflow: z.object({
      name: z.string().min(1).max(120),
      stages: z.array(
        z.object({
          key: templateKeyOpenApiSchema,
          name: z.string().min(1).max(120),
          category: workflowStageCategoryOpenApiSchema,
          color: z.string().max(32).nullable().optional(),
          position: z.number().int().min(0).max(99),
          isInitial: z.boolean(),
          isTerminal: z.boolean(),
          isActive: z.boolean(),
        }),
      ),
      transitions: z.array(
        z.object({
          fromKey: templateKeyOpenApiSchema,
          toKey: templateKeyOpenApiSchema,
          requiredPermission: z.string().max(128).nullable().optional(),
          conditionsJson: workflowConditionsOpenApiSchema,
        }),
      ),
    }),
    tags: z.array(
      z.object({
        key: templateKeyOpenApiSchema,
        name: z.string().min(1).max(80),
        color: z.string().min(1).max(32),
      }),
    ),
    customFields: z.array(
      z.object({
        key: templateKeyOpenApiSchema,
        name: z.string().min(1).max(120),
        fieldType: z.enum([
          "TEXT",
          "NUMBER",
          "BOOLEAN",
          "DATE",
          "SELECT",
          "MULTI_SELECT",
          "USER",
        ]),
        isRequired: z.boolean(),
        options: z.array(z.unknown()).max(100),
        defaultValue: z.unknown().optional(),
        position: z.number().int().min(0).max(199),
        isActive: z.boolean(),
      }),
    ),
    milestones: z.array(
      z.object({
        key: templateKeyOpenApiSchema,
        name: z.string().min(1).max(120),
        description: z.string().max(5000).nullable().optional(),
        status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
        position: z.number().int().min(0).max(499),
        startOffsetDays: templateOffsetOpenApiSchema.nullable().optional(),
        dueOffsetDays: templateOffsetOpenApiSchema.nullable().optional(),
      }),
    ),
    tasks: z.array(
      z.object({
        key: templateKeyOpenApiSchema,
        title: z.string().min(1).max(500),
        description: z.string().max(20_000).nullable().optional(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
        stageKey: templateKeyOpenApiSchema,
        parentKey: templateKeyOpenApiSchema.nullable().optional(),
        subtaskPosition: z.number().int().min(0).max(9999).nullable().optional(),
        milestoneKey: templateKeyOpenApiSchema.nullable().optional(),
        assigneePlaceholderKey: templateKeyOpenApiSchema.nullable().optional(),
        startOffsetDays: templateOffsetOpenApiSchema.nullable().optional(),
        dueOffsetDays: templateOffsetOpenApiSchema.nullable().optional(),
        durationDays: z.number().int().min(0).max(3650).nullable().optional(),
        position: z.number().int().min(0).max(9999),
        checklist: z.array(
          z.object({
            title: z.string().min(1).max(500),
            position: z.number().int().min(0).max(499),
            isCompleted: z.boolean(),
          }),
        ),
        tagKeys: z.array(templateKeyOpenApiSchema),
        customValues: z.record(templateKeyOpenApiSchema, z.unknown()),
      }),
    ),
    dependencies: z.array(
      z.object({
        predecessorKey: templateKeyOpenApiSchema,
        successorKey: templateKeyOpenApiSchema,
        dependencyType: z.literal("FINISH_TO_START"),
      }),
    ),
  }),
);
const templateRecordOpenApiSchema = registry.register(
  "ProjectTemplateV2",
  z.object({
    id: uuidSchema,
    seriesId: uuidSchema,
    workspaceId: uuidSchema.nullable(),
    name: z.string(),
    description: z.string().nullable(),
    industryCode: z.string().nullable(),
    visibility: z.enum(["WORKSPACE", "SYSTEM"]),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
    version: z.number().int().min(0),
    contentSchemaVersion: z.literal(2),
    contentJson: templateContentOpenApiSchema,
    contentHash: z.string().nullable(),
    publishedAt: isoDateTimeSchema.nullable(),
    supersededAt: isoDateTimeSchema.nullable(),
    createdById: uuidSchema.nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  }),
);
const cloneRequestOpenApiSchema = registry.register(
  "TemplateCloneRequest",
  z.object({
    projectName: z.string().min(2).max(120),
    projectCode: z
      .string()
      .min(2)
      .max(32)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional(),
    startAt: isoDateTimeSchema.optional(),
    idempotencyKey: z.string().min(8).max(128),
    memberBindings: z.record(z.string(), uuidSchema).default({}),
  }),
);
const cloneResultOpenApiSchema = registry.register(
  "TemplateCloneResult",
  z.object({
    mode: z.enum(["sync", "async", "existing"]),
    cloneJobId: uuidSchema,
    projectId: uuidSchema.nullable(),
  }),
);
const cloneJobOpenApiSchema = registry.register(
  "TemplateCloneJob",
  z.object({
    id: uuidSchema,
    templateId: uuidSchema,
    projectId: uuidSchema.nullable(),
    status: z.enum([
      "PENDING",
      "PROCESSING",
      "RETRY_WAIT",
      "COMPLETED",
      "FAILED",
      "DEAD",
    ]),
    progress: z.number().int().min(0).max(100),
    attempts: z.number().int().min(0),
    maxAttempts: z.number().int().min(1),
    nextAttemptAt: isoDateTimeSchema.nullable(),
    errorMessage: z.string().nullable(),
    resultJson: z.unknown().nullable(),
    createdAt: isoDateTimeSchema,
    completedAt: isoDateTimeSchema.nullable(),
  }),
);
const createTemplateOpenApiSchema = registry.register(
  "CreateProjectTemplateV2Input",
  z.object({
    name: z.string().min(2).max(120),
    description: z.string().max(5000).optional(),
    industryCode: z.string().max(64).optional(),
    visibility: z.enum(["WORKSPACE", "SYSTEM"]).default("WORKSPACE"),
    contentJson: templateContentOpenApiSchema.optional(),
  }),
);
const updateTemplateOpenApiSchema = registry.register(
  "UpdateProjectTemplateV2Input",
  z.object({
    name: z.string().min(2).max(120).optional(),
    description: z.string().max(5000).nullable().optional(),
    industryCode: z.string().max(64).nullable().optional(),
    contentJson: templateContentOpenApiSchema.optional(),
  }),
);

const milestoneOpenApiSchema = registry.register(
  "Milestone",
  z.object({
    id: uuidSchema,
    workspaceId: uuidSchema,
    projectId: uuidSchema,
    name: z.string(),
    description: z.string().nullable(),
    status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
    position: z.number().int().min(0),
    startAt: isoDateTimeSchema.nullable(),
    dueAt: isoDateTimeSchema.nullable(),
    completedAt: isoDateTimeSchema.nullable(),
    createdById: uuidSchema.nullable(),
    createdBy: z
      .object({ id: uuidSchema, fullName: z.string(), email: z.string().email() })
      .nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    taskCount: z.number().int().min(0),
  }),
);
const createMilestoneOpenApiSchema = registry.register(
  "CreateMilestoneInput",
  z.object({
    name: z.string().min(1).max(120),
    description: z.string().max(1000).optional(),
    status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
    position: z.number().int().min(0).optional(),
    startAt: isoDateTimeSchema.nullable().optional(),
    dueAt: isoDateTimeSchema.nullable().optional(),
  }),
);
const updateMilestoneOpenApiSchema = registry.register(
  "UpdateMilestoneInput",
  createMilestoneOpenApiSchema.partial(),
);
const reorderMilestonesOpenApiSchema = registry.register(
  "ReorderMilestonesInput",
  z.object({ milestoneIds: z.array(uuidSchema).min(1).max(500) }),
);
registry.register(
  "TaskHierarchy",
  z.object({
    parentTaskId: uuidSchema.nullable(),
    subtaskPosition: z.number().int().min(0).nullable(),
    milestoneId: uuidSchema.nullable(),
    maximumDepth: z.literal(5),
  }),
);

function successEnvelope(schema: z.ZodTypeAny) {
  return z.object({
    success: z.literal(true),
    data: schema,
    meta: z.object({ requestId: z.string().optional() }).passthrough(),
  });
}

function jsonResponse(description: string, schema?: z.ZodTypeAny) {
  return schema
    ? {
        description,
        content: { "application/json": { schema: successEnvelope(schema) } },
      }
    : { description };
}

function phase82Responses(
  status: 200 | 201 | 202,
  description: string,
  schema?: z.ZodTypeAny,
  options: { badRequest?: boolean; conflict?: boolean } = {},
) {
  return {
    [status]: jsonResponse(description, schema),
    ...(options.badRequest
      ? { 400: { description: "Validation or domain rule error" } }
      : {}),
    401: { description: "Missing or invalid bearer token" },
    403: { description: "Insufficient permission or project access" },
    404: {
      description: "Workspace, project, workflow, template, job, or milestone not found",
    },
    ...(options.conflict
      ? { 409: { description: "Resource state or idempotency conflict" } }
      : {}),
  };
}

const workflowPathBase = "/api/v1/workspaces/{workspaceId}/projects/{projectId}/workflow";
const workflowDraftParamsSchema = projectParamsSchema.extend({ workflowId: uuidSchema });
const workflowStagePathParamsSchema = workflowDraftParamsSchema.extend({
  stageId: uuidSchema,
});

for (const endpoint of [
  {
    method: "get" as const,
    path: workflowPathBase,
    operationId: "getProjectWorkflowState",
    params: projectParamsSchema,
    query: undefined,
    body: undefined,
    status: 200 as const,
    output: projectWorkflowStateOpenApiSchema,
    description: "Published workflow, current draft, and applied version",
    badRequest: false,
  },
  {
    method: "post" as const,
    path: `${workflowPathBase}/draft`,
    operationId: "createProjectWorkflowDraft",
    params: projectParamsSchema,
    query: undefined,
    body: undefined,
    status: 201 as const,
    output: workflowOpenApiSchema,
    description: "Editable draft cloned from the published workflow",
    badRequest: false,
  },
  {
    method: "get" as const,
    path: `${workflowPathBase}/drafts/{workflowId}`,
    operationId: "getProjectWorkflowDraft",
    params: workflowDraftParamsSchema,
    query: undefined,
    body: undefined,
    status: 200 as const,
    output: workflowOpenApiSchema,
    description: "Workflow draft with stages and transitions",
    badRequest: true,
  },
  {
    method: "get" as const,
    path: `${workflowPathBase}/drafts/{workflowId}/publish-preview`,
    operationId: "previewProjectWorkflowPublish",
    params: workflowDraftParamsSchema,
    query: undefined,
    body: undefined,
    status: 200 as const,
    output: workflowPublishPreviewOpenApiSchema,
    description: "Task usage and mappings required before publish",
    badRequest: true,
  },
  {
    method: "post" as const,
    path: `${workflowPathBase}/drafts/{workflowId}/validate`,
    operationId: "validateProjectWorkflowDraft",
    params: workflowDraftParamsSchema,
    query: undefined,
    body: undefined,
    status: 200 as const,
    output: z.object({ valid: z.literal(true) }),
    description: "Validated workflow draft",
    badRequest: true,
  },
  {
    method: "post" as const,
    path: `${workflowPathBase}/drafts/{workflowId}/stages`,
    operationId: "createProjectWorkflowStage",
    params: workflowDraftParamsSchema,
    query: undefined,
    body: createWorkflowStageSchema,
    status: 201 as const,
    output: workflowStageOpenApiSchema,
    description: "Workflow stage created",
    badRequest: true,
  },
  {
    method: "patch" as const,
    path: `${workflowPathBase}/drafts/{workflowId}/stages/{stageId}`,
    operationId: "updateProjectWorkflowStage",
    params: workflowStagePathParamsSchema,
    query: undefined,
    body: updateWorkflowStageSchema,
    status: 200 as const,
    output: workflowStageOpenApiSchema,
    description: "Workflow stage updated",
    badRequest: true,
  },
  {
    method: "delete" as const,
    path: `${workflowPathBase}/drafts/{workflowId}/stages/{stageId}`,
    operationId: "deleteProjectWorkflowStage",
    params: workflowStagePathParamsSchema,
    query: deleteWorkflowStageQuerySchema,
    body: undefined,
    status: 200 as const,
    output: z.object({ deleted: z.literal(true) }),
    description: "Workflow stage deleted and references remapped when requested",
    badRequest: true,
  },
  {
    method: "put" as const,
    path: `${workflowPathBase}/drafts/{workflowId}/stages/reorder`,
    operationId: "reorderProjectWorkflowStages",
    params: workflowDraftParamsSchema,
    query: undefined,
    body: reorderWorkflowStagesSchema,
    status: 200 as const,
    output: workflowOpenApiSchema,
    description: "Workflow stages reordered",
    badRequest: true,
  },
  {
    method: "put" as const,
    path: `${workflowPathBase}/drafts/{workflowId}/transitions`,
    operationId: "replaceProjectWorkflowTransitions",
    params: workflowDraftParamsSchema,
    query: undefined,
    body: upsertWorkflowTransitionsSchema,
    status: 200 as const,
    output: workflowOpenApiSchema,
    description: "Workflow transitions replaced",
    badRequest: true,
  },
] as const) {
  registry.registerPath({
    method: endpoint.method,
    path: endpoint.path,
    tags: ["Workflows"],
    operationId: endpoint.operationId,
    security: [{ bearerAuth: [] }],
    request: {
      params: endpoint.params,
      ...(endpoint.query ? { query: endpoint.query } : {}),
      ...(endpoint.body ? jsonBody(endpoint.body) : {}),
    },
    responses: phase82Responses(endpoint.status, endpoint.description, endpoint.output, {
      badRequest: endpoint.badRequest,
    }),
  });
}

const templatesPathBase = "/api/v1/workspaces/{workspaceId}/templates";
for (const endpoint of [
  {
    method: "get" as const,
    path: templatesPathBase,
    operationId: "listProjectTemplates",
    params: workspaceIdParamsSchema,
    query: listTemplatesQuerySchema,
    body: undefined,
    status: 200 as const,
    output: z.array(templateRecordOpenApiSchema),
    description: "Workspace and published system templates",
    badRequest: true,
    conflict: false,
  },
  {
    method: "post" as const,
    path: templatesPathBase,
    operationId: "createProjectTemplate",
    params: workspaceIdParamsSchema,
    query: undefined,
    body: createTemplateOpenApiSchema,
    status: 201 as const,
    output: templateRecordOpenApiSchema,
    description: "Draft project template created",
    badRequest: true,
    conflict: false,
  },
  {
    method: "get" as const,
    path: `${templatesPathBase}/clone-jobs/{cloneJobId}`,
    operationId: "getTemplateCloneJob",
    params: cloneJobParamsSchema,
    query: undefined,
    body: undefined,
    status: 200 as const,
    output: cloneJobOpenApiSchema,
    description: "Durable template clone job state",
    badRequest: false,
    conflict: false,
  },
  {
    method: "post" as const,
    path: `${templatesPathBase}/clone-jobs/{cloneJobId}/retry`,
    operationId: "retryTemplateCloneJob",
    params: cloneJobParamsSchema,
    query: undefined,
    body: undefined,
    status: 200 as const,
    output: cloneJobOpenApiSchema,
    description: "Failed or dead clone job queued for retry",
    badRequest: false,
    conflict: true,
  },
  {
    method: "get" as const,
    path: `${templatesPathBase}/{templateId}`,
    operationId: "getProjectTemplate",
    params: templateIdParamsSchema,
    query: undefined,
    body: undefined,
    status: 200 as const,
    output: templateRecordOpenApiSchema,
    description: "Project template content and lifecycle metadata",
    badRequest: false,
    conflict: false,
  },
  {
    method: "patch" as const,
    path: `${templatesPathBase}/{templateId}`,
    operationId: "updateProjectTemplate",
    params: templateIdParamsSchema,
    query: undefined,
    body: updateTemplateOpenApiSchema,
    status: 200 as const,
    output: templateRecordOpenApiSchema,
    description: "Draft project template updated",
    badRequest: true,
    conflict: false,
  },
  {
    method: "post" as const,
    path: `${templatesPathBase}/{templateId}/publish`,
    operationId: "publishProjectTemplate",
    params: templateIdParamsSchema,
    query: undefined,
    body: undefined,
    status: 200 as const,
    output: templateRecordOpenApiSchema,
    description: "Immutable published template version created",
    badRequest: true,
    conflict: false,
  },
  {
    method: "post" as const,
    path: `${templatesPathBase}/{templateId}/validate`,
    operationId: "validateProjectTemplate",
    params: templateIdParamsSchema,
    query: undefined,
    body: undefined,
    status: 200 as const,
    output: z.object({
      valid: z.literal(true),
      schemaVersion: z.literal(2),
      contentHash: z.string(),
    }),
    description: "Template V2 content validated and hashed",
    badRequest: true,
    conflict: false,
  },
  {
    method: "post" as const,
    path: `${templatesPathBase}/{templateId}/versions`,
    operationId: "createProjectTemplateDraftVersion",
    params: templateIdParamsSchema,
    query: undefined,
    body: undefined,
    status: 201 as const,
    output: templateRecordOpenApiSchema,
    description: "Editable version-zero draft created or returned",
    badRequest: false,
    conflict: false,
  },
  {
    method: "get" as const,
    path: `${templatesPathBase}/{templateId}/versions`,
    operationId: "listProjectTemplateVersions",
    params: templateIdParamsSchema,
    query: undefined,
    body: undefined,
    status: 200 as const,
    output: z.array(templateRecordOpenApiSchema),
    description: "Template series versions",
    badRequest: false,
    conflict: false,
  },
  {
    method: "post" as const,
    path: `${templatesPathBase}/{templateId}/archive`,
    operationId: "archiveProjectTemplate",
    params: templateIdParamsSchema,
    query: undefined,
    body: undefined,
    status: 200 as const,
    output: templateRecordOpenApiSchema,
    description: "Project template archived",
    badRequest: false,
    conflict: false,
  },
  {
    method: "post" as const,
    path: `${templatesPathBase}/{templateId}/duplicate`,
    operationId: "duplicateProjectTemplate",
    params: templateIdParamsSchema,
    query: undefined,
    body: undefined,
    status: 201 as const,
    output: templateRecordOpenApiSchema,
    description: "Workspace draft duplicated from visible template",
    badRequest: true,
    conflict: false,
  },
  {
    method: "post" as const,
    path: `${templatesPathBase}/{templateId}/clone`,
    operationId: "cloneProjectFromTemplate",
    params: templateIdParamsSchema,
    query: undefined,
    body: cloneRequestOpenApiSchema,
    status: 202 as const,
    output: cloneResultOpenApiSchema,
    description:
      "Idempotent project clone accepted; sync completion or durable async job",
    badRequest: true,
    conflict: true,
  },
] as const) {
  registry.registerPath({
    method: endpoint.method,
    path: endpoint.path,
    tags: ["Templates"],
    operationId: endpoint.operationId,
    security: [{ bearerAuth: [] }],
    request: {
      params: endpoint.params,
      ...(endpoint.query ? { query: endpoint.query } : {}),
      ...(endpoint.body ? jsonBody(endpoint.body) : {}),
    },
    responses: phase82Responses(endpoint.status, endpoint.description, endpoint.output, {
      badRequest: endpoint.badRequest,
      conflict: endpoint.conflict,
    }),
  });
}

const milestonesPathBase =
  "/api/v1/workspaces/{workspaceId}/projects/{projectId}/milestones";
for (const endpoint of [
  {
    method: "get" as const,
    path: milestonesPathBase,
    operationId: "listProjectMilestones",
    params: projectMilestonesParamsSchema,
    body: undefined,
    status: 200 as const,
    output: z.array(milestoneOpenApiSchema),
    description: "Project milestones ordered by position",
    badRequest: false,
  },
  {
    method: "post" as const,
    path: milestonesPathBase,
    operationId: "createProjectMilestone",
    params: projectMilestonesParamsSchema,
    body: createMilestoneOpenApiSchema,
    status: 201 as const,
    output: milestoneOpenApiSchema,
    description: "Project milestone created",
    badRequest: true,
  },
  {
    method: "put" as const,
    path: `${milestonesPathBase}/reorder`,
    operationId: "reorderProjectMilestones",
    params: projectMilestonesParamsSchema,
    body: reorderMilestonesOpenApiSchema,
    status: 200 as const,
    output: z.array(milestoneOpenApiSchema),
    description: "Project milestones reordered",
    badRequest: true,
  },
  {
    method: "get" as const,
    path: `${milestonesPathBase}/{milestoneId}`,
    operationId: "getProjectMilestone",
    params: milestoneParamsSchema,
    body: undefined,
    status: 200 as const,
    output: milestoneOpenApiSchema,
    description: "Project milestone details",
    badRequest: false,
  },
  {
    method: "patch" as const,
    path: `${milestonesPathBase}/{milestoneId}`,
    operationId: "updateProjectMilestone",
    params: milestoneParamsSchema,
    body: updateMilestoneOpenApiSchema,
    status: 200 as const,
    output: milestoneOpenApiSchema,
    description: "Project milestone updated",
    badRequest: true,
  },
  {
    method: "delete" as const,
    path: `${milestonesPathBase}/{milestoneId}`,
    operationId: "deleteProjectMilestone",
    params: milestoneParamsSchema,
    body: undefined,
    status: 200 as const,
    output: z.object({ deleted: z.literal(true) }),
    description: "Project milestone deleted",
    badRequest: false,
  },
] as const) {
  registry.registerPath({
    method: endpoint.method,
    path: endpoint.path,
    tags: ["Milestones"],
    operationId: endpoint.operationId,
    security: [{ bearerAuth: [] }],
    request: {
      params: endpoint.params,
      ...(endpoint.body ? jsonBody(endpoint.body) : {}),
    },
    responses: phase82Responses(endpoint.status, endpoint.description, endpoint.output, {
      badRequest: endpoint.badRequest,
    }),
  });
}

registry.registerPath({
  method: "post",
  path: `${workflowPathBase}/publish`,
  tags: ["Workflows"],
  operationId: "publishProjectWorkflow",
  security: [{ bearerAuth: [] }],
  request: {
    params: projectParamsSchema,
    ...jsonBody(workflowPublishInputOpenApiSchema),
  },
  responses: {
    200: jsonResponse(
      "Published project workflow and migrated tasks atomically",
      workflowPublishResultOpenApiSchema,
    ),
    400: {
      description: "Invalid workflow, incomplete mappings, or invalid migration input",
    },
    401: { description: "Missing or invalid bearer token" },
    403: { description: "Project settings access denied" },
    404: { description: "Project or draft workflow not found" },
    409: {
      description: "Draft is no longer publishable or workflow changed concurrently",
    },
  },
});

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

export function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: "3.0.3",
    info: {
      title: "TaskMng SME API",
      version: "8.2.0",
      description:
        "Phase 8.2 API: secured per-project workflows and conditional transitions, atomic publish/task migration, V2 project templates, durable idempotent clone jobs, milestones, and five-level task hierarchy.",
    },
    servers: [{ url: "http://localhost:4000" }],
  });
}

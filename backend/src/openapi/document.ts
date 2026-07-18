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
  createProjectSchema,
  eligibleAssigneesQuerySchema,
  projectParamsSchema,
  replaceProjectMembersSchema,
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
  method: "get",
  path: "/api/v1/workspaces/{workspaceId}/projects/{projectId}/members",
  tags: ["Projects"],
  security: [{ bearerAuth: [] }],
  request: { params: projectParamsSchema },
  responses: { 200: { description: "Project member summaries" } },
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
      version: "7.1.0",
      description:
        "Phase 7.1 Task Metadata & Collaboration API (checklist, tags, custom fields, comments, attachments)",
    },
    servers: [{ url: "http://localhost:4000" }],
  });
}

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
  bulkDeleteSchema,
  bulkUpdateSchema,
  createTaskSchema,
  deleteTaskQuerySchema,
  listTasksQuerySchema,
  parseTaskSchema,
  statusMutationSchema,
  taskActivityQuerySchema,
  taskIdParamsSchema,
  updateTaskSchema,
  versionMutationSchema,
} from "../modules/tasks/tasks.schemas.js";
import {
  listNotificationsQuerySchema,
  notificationParamsSchema,
  updateNotificationPreferenceSchema,
} from "../modules/notifications/notifications.schemas.js";
import {
  activityQuerySchema,
  dashboardQuerySchema,
  myWorkQuerySchema,
} from "../modules/dashboard/dashboard.schemas.js";

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
      version: "5.0.0",
      description: "Phase 5 Core Task Management & Assignment API",
    },
    servers: [{ url: "http://localhost:4000" }],
  });
}

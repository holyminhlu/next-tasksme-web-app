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
      version: "2.0.0",
      description: "Phase 2 Workspace & Onboarding API",
    },
    servers: [{ url: "http://localhost:4000" }],
  });
}

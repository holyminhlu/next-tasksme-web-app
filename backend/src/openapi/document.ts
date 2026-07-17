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
  selectCompanySchema,
  verifyEmailSchema,
} from "../modules/auth/auth.schemas.js";
import {
  acceptInvitationSchema,
  companyIdParamsSchema,
  inviteMemberSchema,
  listMembersQuerySchema,
  updateCompanySchema,
} from "../modules/companies/companies.schemas.js";

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
    path: "/api/v1/auth/select-company",
    tag: "Auth",
    schema: selectCompanySchema,
    security: true,
  },
  { method: "get", path: "/api/v1/me/companies", tag: "Auth", security: true },
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
  method: "get",
  path: "/api/v1/companies/{companyId}",
  tags: ["Companies"],
  security: [{ bearerAuth: [] }],
  request: { params: companyIdParamsSchema },
  responses: { 200: { description: "Company details" } },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/companies/{companyId}",
  tags: ["Companies"],
  security: [{ bearerAuth: [] }],
  request: {
    params: companyIdParamsSchema,
    ...jsonBody(updateCompanySchema),
  },
  responses: { 200: { description: "Company updated" } },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/companies/{companyId}/members",
  tags: ["Companies"],
  security: [{ bearerAuth: [] }],
  request: {
    params: companyIdParamsSchema,
    query: listMembersQuerySchema,
  },
  responses: { 200: { description: "Company members" } },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/companies/{companyId}/invitations",
  tags: ["Companies"],
  security: [{ bearerAuth: [] }],
  request: {
    params: companyIdParamsSchema,
    ...jsonBody(inviteMemberSchema),
  },
  responses: { 201: { description: "Invitation created" } },
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
      version: "1.1.0",
      description: "Phase 1 Authentication & Authorization API",
    },
    servers: [{ url: "http://localhost:4000" }],
  });
}

import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { loginSchema, registerSchema } from "../modules/auth/auth.schemas.js";
import {
  companyIdParamsSchema,
  listMembersQuerySchema,
  updateCompanySchema,
} from "../modules/companies/companies.schemas.js";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

registry.registerPath({
  method: "get",
  path: "/api/v1/health/live",
  tags: ["Health"],
  responses: {
    200: {
      description: "Liveness probe",
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/health/ready",
  tags: ["Health"],
  responses: {
    200: {
      description: "Readiness probe",
    },
    503: {
      description: "Dependencies unavailable",
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/register",
  tags: ["Auth"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: registerSchema,
        },
      },
    },
  },
  responses: {
    201: { description: "Registered" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/login",
  tags: ["Auth"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: loginSchema,
        },
      },
    },
  },
  responses: {
    200: { description: "Logged in" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/refresh",
  tags: ["Auth"],
  responses: {
    200: { description: "Token refreshed" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/logout",
  tags: ["Auth"],
  responses: {
    200: { description: "Logged out" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/auth/me",
  tags: ["Auth"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "Current user" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/companies/{companyId}",
  tags: ["Companies"],
  security: [{ bearerAuth: [] }],
  request: {
    params: companyIdParamsSchema,
  },
  responses: {
    200: { description: "Company details" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/companies/{companyId}",
  tags: ["Companies"],
  security: [{ bearerAuth: [] }],
  request: {
    params: companyIdParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: updateCompanySchema,
        },
      },
    },
  },
  responses: {
    200: { description: "Company updated" },
  },
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
  responses: {
    200: { description: "Company members" },
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
      version: "1.0.0",
      description: "Phase 0 foundation API for Task Management SME",
    },
    servers: [
      {
        url: "http://localhost:4000",
      },
    ],
  });
}

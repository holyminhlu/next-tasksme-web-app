import { describe, expect, it } from "vitest";
import { buildOpenApiDocument } from "../src/openapi/document.js";

type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

const phase82Routes: Array<[HttpMethod, string]> = [
  ["get", "/api/v1/workspaces/{workspaceId}/projects/{projectId}/workflow"],
  ["post", "/api/v1/workspaces/{workspaceId}/projects/{projectId}/workflow/draft"],
  [
    "get",
    "/api/v1/workspaces/{workspaceId}/projects/{projectId}/workflow/drafts/{workflowId}",
  ],
  [
    "get",
    "/api/v1/workspaces/{workspaceId}/projects/{projectId}/workflow/drafts/{workflowId}/publish-preview",
  ],
  [
    "post",
    "/api/v1/workspaces/{workspaceId}/projects/{projectId}/workflow/drafts/{workflowId}/validate",
  ],
  [
    "post",
    "/api/v1/workspaces/{workspaceId}/projects/{projectId}/workflow/drafts/{workflowId}/stages",
  ],
  [
    "patch",
    "/api/v1/workspaces/{workspaceId}/projects/{projectId}/workflow/drafts/{workflowId}/stages/{stageId}",
  ],
  [
    "delete",
    "/api/v1/workspaces/{workspaceId}/projects/{projectId}/workflow/drafts/{workflowId}/stages/{stageId}",
  ],
  [
    "put",
    "/api/v1/workspaces/{workspaceId}/projects/{projectId}/workflow/drafts/{workflowId}/stages/reorder",
  ],
  [
    "put",
    "/api/v1/workspaces/{workspaceId}/projects/{projectId}/workflow/drafts/{workflowId}/transitions",
  ],
  ["post", "/api/v1/workspaces/{workspaceId}/projects/{projectId}/workflow/publish"],
  ["get", "/api/v1/workspaces/{workspaceId}/templates"],
  ["post", "/api/v1/workspaces/{workspaceId}/templates"],
  ["get", "/api/v1/workspaces/{workspaceId}/templates/clone-jobs/{cloneJobId}"],
  ["post", "/api/v1/workspaces/{workspaceId}/templates/clone-jobs/{cloneJobId}/retry"],
  ["get", "/api/v1/workspaces/{workspaceId}/templates/{templateId}"],
  ["patch", "/api/v1/workspaces/{workspaceId}/templates/{templateId}"],
  ["post", "/api/v1/workspaces/{workspaceId}/templates/{templateId}/publish"],
  ["post", "/api/v1/workspaces/{workspaceId}/templates/{templateId}/validate"],
  ["post", "/api/v1/workspaces/{workspaceId}/templates/{templateId}/versions"],
  ["get", "/api/v1/workspaces/{workspaceId}/templates/{templateId}/versions"],
  ["post", "/api/v1/workspaces/{workspaceId}/templates/{templateId}/archive"],
  ["post", "/api/v1/workspaces/{workspaceId}/templates/{templateId}/duplicate"],
  ["post", "/api/v1/workspaces/{workspaceId}/templates/{templateId}/clone"],
  ["get", "/api/v1/workspaces/{workspaceId}/projects/{projectId}/milestones"],
  ["post", "/api/v1/workspaces/{workspaceId}/projects/{projectId}/milestones"],
  ["put", "/api/v1/workspaces/{workspaceId}/projects/{projectId}/milestones/reorder"],
  [
    "get",
    "/api/v1/workspaces/{workspaceId}/projects/{projectId}/milestones/{milestoneId}",
  ],
  [
    "patch",
    "/api/v1/workspaces/{workspaceId}/projects/{projectId}/milestones/{milestoneId}",
  ],
  [
    "delete",
    "/api/v1/workspaces/{workspaceId}/projects/{projectId}/milestones/{milestoneId}",
  ],
];

describe("Phase 8.2 OpenAPI document", () => {
  const document = buildOpenApiDocument();

  it("keeps the Phase 8.2 version and description", () => {
    expect(document.info.version).toBe("8.2.0");
    expect(document.info.description).toContain("durable idempotent clone jobs");
    expect(document.info.description).toContain("five-level task hierarchy");
  });

  it.each(phase82Routes)("%s %s is documented and secured", (method, path) => {
    const operation = document.paths[path]?.[method];
    expect(operation, `${method.toUpperCase()} ${path}`).toBeDefined();
    expect(operation?.operationId).toBeTruthy();
    expect(operation?.tags?.length).toBeGreaterThan(0);
    expect(operation?.security).toEqual([{ bearerAuth: [] }]);
    expect(operation?.responses?.["401"]).toBeDefined();
    expect(operation?.responses?.["403"]).toBeDefined();
    expect(operation?.responses?.["404"]).toBeDefined();
  });

  it("uses unique operation IDs for every Phase 8.2 route", () => {
    const operationIds = phase82Routes.map(
      ([method, path]) => document.paths[path]?.[method]?.operationId,
    );
    expect(operationIds.every(Boolean)).toBe(true);
    expect(new Set(operationIds).size).toBe(operationIds.length);
  });

  it("registers the reusable workflow, template, clone, milestone, and hierarchy schemas", () => {
    const schemas = document.components?.schemas ?? {};
    expect(schemas).toMatchObject({
      WorkflowConditions: expect.any(Object),
      WorkflowStage: expect.any(Object),
      WorkflowTransition: expect.any(Object),
      Workflow: expect.any(Object),
      ProjectWorkflowState: expect.any(Object),
      WorkflowPublishPreview: expect.any(Object),
      WorkflowPublishInput: expect.any(Object),
      WorkflowPublishResult: expect.any(Object),
      TemplateContentV2: expect.any(Object),
      ProjectTemplateV2: expect.any(Object),
      TemplateCloneRequest: expect.any(Object),
      TemplateCloneResult: expect.any(Object),
      TemplateCloneJob: expect.any(Object),
      Milestone: expect.any(Object),
      TaskHierarchy: expect.any(Object),
    });
  });

  it("documents exact non-200 creation and clone statuses", () => {
    const paths = document.paths;
    expect(
      paths["/api/v1/workspaces/{workspaceId}/templates"]?.post?.responses,
    ).toHaveProperty("201");
    expect(
      paths["/api/v1/workspaces/{workspaceId}/templates/{templateId}/clone"]?.post
        ?.responses,
    ).toHaveProperty("202");
    expect(
      paths["/api/v1/workspaces/{workspaceId}/projects/{projectId}/workflow/draft"]?.post
        ?.responses,
    ).toHaveProperty("201");
    expect(
      paths["/api/v1/workspaces/{workspaceId}/projects/{projectId}/milestones"]?.post
        ?.responses,
    ).toHaveProperty("201");
  });

  it("exposes hierarchy fields on task create and update request schemas", () => {
    for (const method of ["post", "patch"] as const) {
      const path =
        method === "post"
          ? "/api/v1/workspaces/{workspaceId}/tasks"
          : "/api/v1/workspaces/{workspaceId}/tasks/{taskId}";
      const operation = document.paths[path]?.[method];
      const body = operation?.requestBody;
      expect(
        body && "content" in body ? body.content["application/json"] : undefined,
      ).toMatchObject({
        schema: {
          properties: {
            parentTaskId: expect.any(Object),
            subtaskPosition: expect.any(Object),
            milestoneId: expect.any(Object),
          },
        },
      });
    }
  });
});

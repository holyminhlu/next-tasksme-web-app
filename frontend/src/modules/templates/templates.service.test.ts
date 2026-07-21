import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}));

import { get, patch, post } from "@/lib/api/client";
import * as service from "./templates.service";

const WS = "workspace-1";
const ok = (data: unknown, meta?: Record<string, unknown>) => ({ success: true as const, data, meta });
const template = {
  id: "template-1", seriesId: "series-1", workspaceId: WS, name: "Delivery",
  version: 0, visibility: "WORKSPACE", status: "DRAFT", contentSchemaVersion: 2,
  contentHash: "hash", contentJson: { schemaVersion: 2 }, createdAt: "", updatedAt: "",
};

beforeEach(() => {
  vi.mocked(get).mockReset();
  vi.mocked(post).mockReset();
  vi.mocked(patch).mockReset();
});

describe("template lifecycle service", () => {
  it("sends list filters and maps pagination", async () => {
    vi.mocked(get).mockResolvedValue(ok([template], {
      pagination: { page: 2, pageSize: 10, total: 21, totalPages: 3 },
    }));
    const result = await service.listTemplates(WS, {
      search: "delivery", status: "DRAFT", visibility: "WORKSPACE", page: 2, pageSize: 10,
    });
    expect(vi.mocked(get).mock.calls[0][0]).toContain("visibility=WORKSPACE");
    expect(result.ok && result.data.totalPages).toBe(3);
  });

  it.each([
    ["publishTemplate", "/template-1/publish"],
    ["archiveTemplate", "/template-1/archive"],
    ["duplicateTemplate", "/template-1/duplicate"],
    ["createTemplateVersion", "/template-1/versions"],
  ] as const)("calls %s lifecycle route", async (method, suffix) => {
    vi.mocked(post).mockResolvedValue(ok(template));
    const result = await service[method](WS, "template-1");
    expect(post).toHaveBeenCalledWith(`/workspaces/${WS}/templates${suffix}`, {});
    expect(result.ok).toBe(true);
  });

  it("sends member bindings and stable key to clone", async () => {
    vi.mocked(post).mockResolvedValue(ok({ mode: "async", cloneJobId: "job-1", projectId: null }));
    await service.cloneTemplate(WS, "template-1", {
      projectName: "New project",
      idempotencyKey: "stable-key",
      memberBindings: { manager: "11111111-1111-1111-1111-111111111111" },
    });
    expect(post).toHaveBeenCalledWith(`/workspaces/${WS}/templates/template-1/clone`, {
      projectName: "New project",
      idempotencyKey: "stable-key",
      memberBindings: { manager: "11111111-1111-1111-1111-111111111111" },
    });
  });

  it("retries failed clone jobs", async () => {
    vi.mocked(post).mockResolvedValue(ok({
      id: "job-1", templateId: "template-1", status: "PENDING", progress: 0,
    }));
    const result = await service.retryCloneJob(WS, "job-1");
    expect(post).toHaveBeenCalledWith(`/workspaces/${WS}/templates/clone-jobs/job-1/retry`, {});
    expect(result.ok && result.data.status).toBe("PENDING");
  });
});

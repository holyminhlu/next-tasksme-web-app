import { describe, expect, it } from "vitest";
import {
  cloneJobDisposition,
  clonePollDelay,
  getOrCreateIdempotencyKey,
  mapCloneJob,
  mapTemplate,
  mapTemplateList,
} from "./templates.helpers";

const content = {
  schemaVersion: 2,
  project: {},
  memberPlaceholders: [],
  workflow: { name: "Delivery", stages: [], transitions: [] },
  tags: [],
  customFields: [],
  milestones: [],
  tasks: [],
  dependencies: [],
};

const template = {
  id: "template-1",
  seriesId: "series-1",
  workspaceId: "workspace-1",
  name: "Delivery",
  description: null,
  industryCode: null,
  version: 2,
  visibility: "WORKSPACE",
  status: "PUBLISHED",
  contentSchemaVersion: 2,
  contentHash: "abc",
  contentJson: content,
  publishedAt: "2026-07-20T00:00:00.000Z",
  supersededAt: null,
  createdById: "user-1",
  createdAt: "2026-07-20T00:00:00.000Z",
  updatedAt: "2026-07-20T00:00:00.000Z",
};

describe("template mappings", () => {
  it("maps lifecycle and content fields", () => {
    expect(mapTemplate(template)).toMatchObject({
      seriesId: "series-1",
      contentSchemaVersion: 2,
      contentHash: "abc",
      publishedAt: template.publishedAt,
      supersededAt: null,
      contentJson: content,
    });
  });

  it("maps pagination metadata", () => {
    expect(mapTemplateList([template], {
      pagination: { page: 2, pageSize: 1, total: 3, totalPages: 3 },
    })).toMatchObject({ page: 2, pageSize: 1, total: 3, totalPages: 3 });
  });

  it("rejects malformed template responses", () => {
    expect(mapTemplate({ ...template, seriesId: undefined })).toBeNull();
    expect(mapTemplate({ ...template, contentJson: { schemaVersion: 1 } })).toBeNull();
  });

  it("maps hardened clone states and retry metadata", () => {
    expect(mapCloneJob({
      id: "job-1", templateId: "template-1", status: "RETRY_WAIT",
      progress: 40, attempts: 2, maxAttempts: 5, nextAttemptAt: "soon",
    })).toMatchObject({ status: "RETRY_WAIT", attempts: 2, maxAttempts: 5 });
  });
});

describe("clone state machine", () => {
  it("classifies terminal and active states", () => {
    expect(cloneJobDisposition("PENDING")).toBe("poll");
    expect(cloneJobDisposition("RETRY_WAIT")).toBe("poll");
    expect(cloneJobDisposition("COMPLETED")).toBe("completed");
    expect(cloneJobDisposition("FAILED")).toBe("retryable");
    expect(cloneJobDisposition("DEAD")).toBe("retryable");
    expect(cloneJobDisposition("CANCELLED")).toBe("stopped");
  });

  it("backs off and slows polling while hidden", () => {
    expect(clonePollDelay(0)).toBe(1500);
    expect(clonePollDelay(99)).toBeLessThanOrEqual(15_000);
    expect(clonePollDelay(0, true)).toBeGreaterThanOrEqual(10_000);
  });

  it("keeps an idempotency key stable for a clone scope", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    let generated = 0;
    const first = getOrCreateIdempotencyKey(storage, "template-1", () => `key-${++generated}`);
    const second = getOrCreateIdempotencyKey(storage, "template-1", () => `key-${++generated}`);
    expect(first).toBe("key-1");
    expect(second).toBe(first);
    expect(generated).toBe(1);
  });
});

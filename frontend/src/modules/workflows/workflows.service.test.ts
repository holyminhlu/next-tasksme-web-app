import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

import { del, get, patch, post, put } from "@/lib/api/client";
import * as service from "./workflows.service";
import type { WorkflowTransitionInput } from "./workflows.types";

const ok = (data: unknown) => ({ success: true as const, data });
const base = "/workspaces/workspace-1/projects/project-1/workflow";

beforeEach(() => {
  vi.mocked(get).mockReset();
  vi.mocked(post).mockReset();
  vi.mocked(patch).mockReset();
  vi.mocked(put).mockReset();
  vi.mocked(del).mockReset();
});

describe("project-nested workflow routes", () => {
  it("uses the draft stage routes and exact payloads", async () => {
    vi.mocked(post).mockResolvedValue(
      ok({
        id: "stage-1",
        workflowId: "workflow-1",
        name: "Review",
        category: "IN_PROGRESS",
      }),
    );
    await service.addStage("workspace-1", "project-1", "workflow-1", {
      name: "Review",
      category: "IN_PROGRESS",
      color: "#123456",
    });
    expect(post).toHaveBeenCalledWith(`${base}/drafts/workflow-1/stages`, {
      name: "Review",
      category: "IN_PROGRESS",
      color: "#123456",
    });

    vi.mocked(patch).mockResolvedValue(
      ok({
        id: "stage-1",
        workflowId: "workflow-1",
        name: "QA",
        category: "IN_PROGRESS",
      }),
    );
    await service.updateStage(
      "workspace-1",
      "project-1",
      "workflow-1",
      "stage-1",
      { name: "QA", isTerminal: true },
    );
    expect(patch).toHaveBeenCalledWith(
      `${base}/drafts/workflow-1/stages/stage-1`,
      { name: "QA", isTerminal: true },
    );

    vi.mocked(del).mockResolvedValue(ok({ deleted: true }));
    await service.deleteStage(
      "workspace-1",
      "project-1",
      "workflow-1",
      "stage-1",
    );
    expect(del).toHaveBeenCalledWith(`${base}/drafts/workflow-1/stages/stage-1`);
  });

  it("preserves complete transition payloads", async () => {
    vi.mocked(put).mockResolvedValue(
      ok({
        id: "workflow-1",
        familyId: "family-1",
        workspaceId: "workspace-1",
        stages: [],
        transitions: [],
      }),
    );
    const transitions: WorkflowTransitionInput[] = [
      {
        fromStageId: "stage-1",
        toStageId: "stage-2",
        requiredPermission: "tasks:approve",
        conditionsJson: {
          version: 1,
          all: [{ field: "task.assigneeId", operator: "isSet" }],
        },
      },
    ];
    await service.saveTransitions(
      "workspace-1",
      "project-1",
      "workflow-1",
      transitions,
    );
    expect(put).toHaveBeenCalledWith(
      `${base}/drafts/workflow-1/transitions`,
      { transitions },
    );
  });

  it("calls validation and publish-preview on the draft route", async () => {
    vi.mocked(post).mockResolvedValue(ok({ valid: true }));
    await service.validateWorkflowDraft("workspace-1", "project-1", "workflow-1");
    expect(post).toHaveBeenCalledWith(
      `${base}/drafts/workflow-1/validate`,
      {},
    );

    vi.mocked(get).mockResolvedValue(
      ok({
        taskCount: 0,
        currentStages: [],
        requiredStageMappings: [],
        legacyStatusCounts: [],
        requiresMapping: false,
      }),
    );
    await service.getPublishPreview("workspace-1", "project-1", "workflow-1");
    expect(get).toHaveBeenCalledWith(
      `${base}/drafts/workflow-1/publish-preview`,
    );
  });

  it("posts legacy and stage mappings to project publish", async () => {
    vi.mocked(post).mockResolvedValue(
      ok({ workflowId: "published-1", workflowVersion: 2, movedTasks: 3 }),
    );
    const payload = {
      draftWorkflowId: "workflow-1",
      stageMappings: [{ fromStageId: "old-1", toStageId: "new-1" }],
      legacyStatusMappings: [{ fromStatus: "TODO", toStageId: "new-1" }],
    };
    await service.publishWorkflow("workspace-1", "project-1", payload);
    expect(post).toHaveBeenCalledWith(`${base}/publish`, payload);
  });
});

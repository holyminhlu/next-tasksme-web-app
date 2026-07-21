import { describe, expect, it } from "vitest";
import {
  conditionPayload,
  requiredMappingsComplete,
  toggleTransition,
  toTransitionInputs,
} from "./workflows.helpers";
import type { PublishPreview, WorkflowTransitionRecord } from "./workflows.types";

describe("workflow transition helpers", () => {
  it("preserves permission and condition metadata when editing existing edges", () => {
    const records: WorkflowTransitionRecord[] = [
      {
        id: "transition-1",
        workflowId: "workflow-1",
        fromStageId: "stage-1",
        toStageId: "stage-2",
        requiredPermission: "tasks:approve",
        conditionsJson: {
          version: 1,
          all: [
            {
              field: "task.priority",
              operator: "in",
              value: ["HIGH", "URGENT"],
            },
          ],
        },
      },
    ];

    const inputs = toTransitionInputs(records);
    expect(inputs[0]).toEqual({
      fromStageId: "stage-1",
      toStageId: "stage-2",
      requiredPermission: "tasks:approve",
      conditionsJson: records[0]!.conditionsJson,
    });
    expect(toggleTransition(inputs, "stage-2", "stage-3")[0]).toEqual(inputs[0]);
  });

  it("builds the versioned condition DSL and unconditional payload", () => {
    expect(conditionPayload([])).toEqual({});
    expect(
      conditionPayload([
        { field: "task.checklistComplete", operator: "eq", value: true },
      ]),
    ).toEqual({
      version: 1,
      all: [{ field: "task.checklistComplete", operator: "eq", value: true }],
    });
  });
});

describe("publish mapping completeness", () => {
  const preview: PublishPreview = {
    taskCount: 6,
    currentStages: [
      { id: "unused", name: "Unused", taskCount: 0 },
      { id: "used", name: "Used", taskCount: 4 },
    ],
    requiredStageMappings: [{ id: "used", name: "Used", taskCount: 4 }],
    legacyStatusCounts: [{ status: "TODO", count: 2 }],
    requiresMapping: true,
  };

  it("requires every used stage and legacy status but ignores unused stages", () => {
    expect(requiredMappingsComplete(preview, {}, {})).toBe(false);
    expect(
      requiredMappingsComplete(preview, { used: "target-1" }, { TODO: "target-2" }),
    ).toBe(true);
  });
});

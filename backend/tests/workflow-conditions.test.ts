import { describe, expect, it } from "vitest";
import {
  evaluateWorkflowConditions,
  parseWorkflowConditions,
  validateWorkflowConditions,
} from "../src/lib/workflow-conditions.js";

const context = {
  task: {
    assigneeId: "c93ff829-7103-4b33-a138-fbfb816f7b21",
    priority: "HIGH" as const,
    isBlocked: false,
    checklistComplete: true,
    dependenciesComplete: false,
  },
};

describe("workflow transition conditions", () => {
  it("treats an empty object as unconditional", () => {
    expect(parseWorkflowConditions({})).toEqual({});
    expect(evaluateWorkflowConditions({}, context)).toBe(true);
  });

  it("evaluates every supported clause", () => {
    expect(
      evaluateWorkflowConditions(
        {
          version: 1,
          all: [
            { field: "task.assigneeId", operator: "isSet" },
            { field: "task.priority", operator: "eq", value: "HIGH" },
            { field: "task.priority", operator: "in", value: ["HIGH", "URGENT"] },
            { field: "task.isBlocked", operator: "eq", value: false },
            { field: "task.checklistComplete", operator: "eq", value: true },
            { field: "task.dependenciesComplete", operator: "eq", value: false },
          ],
        },
        context,
      ),
    ).toBe(true);
  });

  it("fails closed for false or malformed conditions", () => {
    expect(
      evaluateWorkflowConditions(
        {
          version: 1,
          all: [{ field: "task.priority", operator: "eq", value: "LOW" }],
        },
        context,
      ),
    ).toBe(false);
    expect(
      evaluateWorkflowConditions(
        {
          version: 1,
          all: [{ field: "task.priority", operator: "contains", value: "HIGH" }],
        },
        context,
      ),
    ).toBe(false);
    expect(validateWorkflowConditions({ version: 2, all: [] }).success).toBe(false);
    expect(
      validateWorkflowConditions({
        version: 1,
        all: [{ field: "task.assigneeId", operator: "isSet", extra: true }],
      }).success,
    ).toBe(false);
    expect(
      validateWorkflowConditions({
        version: 1,
        all: Array.from({ length: 21 }, () => ({
          field: "task.isBlocked",
          operator: "eq",
          value: false,
        })),
      }).success,
    ).toBe(false);
  });
});

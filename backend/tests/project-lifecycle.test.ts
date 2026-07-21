import { describe, expect, it } from "vitest";
import {
  assertProjectStatusTransition,
  assessProjectCompletion,
  computeProjectHealth,
  computeProjectProgress,
} from "../src/lib/project-lifecycle.js";

describe("project lifecycle helpers", () => {
  it("allows valid status transitions", () => {
    expect(() => assertProjectStatusTransition("PLANNING", "ACTIVE")).not.toThrow();
    expect(() => assertProjectStatusTransition("ACTIVE", "COMPLETED")).not.toThrow();
  });

  it("blocks invalid status transitions", () => {
    expect(() => assertProjectStatusTransition("COMPLETED", "ACTIVE")).toThrow();
  });

  it("assesses completion policy behavior", () => {
    const blockers = [
      {
        code: "OPEN_TASKS" as const,
        count: 2,
        message: "2 open",
      },
    ];
    expect(assessProjectCompletion("WARN_ONLY", blockers).canComplete).toBe(true);
    expect(assessProjectCompletion("BLOCK", blockers).canComplete).toBe(false);
    expect(assessProjectCompletion("BLOCK_WITH_OVERRIDE", blockers).requiresOverride).toBe(
      true,
    );
  });

  it("computes progress and health", () => {
    expect(computeProjectProgress(10, 5)).toBe(50);
    expect(computeProjectHealth({ totalTasks: 10, doneTasks: 8, overdueTasks: 0 })).toBe(
      "GOOD",
    );
    expect(computeProjectHealth({ totalTasks: 10, doneTasks: 2, overdueTasks: 1 })).toBe(
      "AT_RISK",
    );
  });
});

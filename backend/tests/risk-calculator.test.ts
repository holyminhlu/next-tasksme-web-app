import { describe, expect, it } from "vitest";
import { calculateTaskRisk } from "../src/lib/risk-calculator.js";

describe("risk calculator", () => {
  it("returns explanatory reasons with the score", () => {
    const result = calculateTaskRisk(
      {
        status: "BLOCKED",
        isBlocked: true,
        blockedSince: "2026-07-10T00:00:00.000Z",
        dueDate: "2026-07-15T00:00:00.000Z",
        assigneeId: null,
        dependencies: [{ status: "TODO" }],
      },
      {},
      new Date("2026-07-18T00:00:00.000Z"),
    );
    expect(result.score).toBe(100);
    expect(result.level).toBe("CRITICAL");
    expect(result.reasons.length).toBe(4);
    expect(result.reasons.every((reason) => reason.length > 10)).toBe(true);
  });

  it("honors custom weights and thresholds", () => {
    const result = calculateTaskRisk(
      { status: "TODO", assigneeId: null },
      { weights: { unassigned: 5 }, thresholds: { medium: 3, high: 5, critical: 10 } },
    );
    expect(result.score).toBe(5);
    expect(result.level).toBe("HIGH");
  });
});

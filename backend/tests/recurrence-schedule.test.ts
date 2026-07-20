import { describe, expect, it } from "vitest";
import { computeNextRunAt, previewNextRuns } from "../src/lib/recurrence-schedule.js";

describe("recurrence schedule", () => {
  it("advances daily schedules by interval in their timezone", () => {
    const next = computeNextRunAt(
      {
        frequency: "DAILY",
        interval: 2,
        timezone: "Asia/Ho_Chi_Minh",
        startAt: "2026-07-18T02:00:00.000Z",
      },
      "2026-07-18T03:00:00.000Z",
    );
    expect(next?.toISOString()).toBe("2026-07-20T02:00:00.000Z");
  });

  it("selects configured weekly days", () => {
    const runs = previewNextRuns(
      {
        frequency: "WEEKLY",
        interval: 1,
        daysOfWeek: [1, 3],
        timezone: "UTC",
        startAt: "2026-07-20T09:00:00.000Z",
      },
      3,
      "2026-07-19T00:00:00.000Z",
    );
    expect(runs.map((run) => run.toISOString())).toEqual([
      "2026-07-20T09:00:00.000Z",
      "2026-07-22T09:00:00.000Z",
      "2026-07-27T09:00:00.000Z",
    ]);
  });

  it("clamps monthly overflow to the final day", () => {
    const next = computeNextRunAt(
      {
        frequency: "MONTHLY",
        dayOfMonth: 31,
        timezone: "UTC",
        startAt: "2026-01-31T10:00:00.000Z",
      },
      "2026-01-31T10:00:00.000Z",
    );
    expect(next?.toISOString()).toBe("2026-02-28T10:00:00.000Z");
  });
});

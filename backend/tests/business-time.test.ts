import { describe, expect, it } from "vitest";
import { addBusinessMinutes, businessMinutesBetween, isWorkingDay, subtractBusinessMinutes } from "../src/lib/business-time.js";

const calendar = {
  timezone: "UTC",
  workingHours: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
    dayOfWeek,
    startMinute: 9 * 60,
    endMinute: 17 * 60,
  })),
  holidays: [{ date: "2026-07-20", isWorking: false }],
};

describe("business time", () => {
  it("skips weekends and holidays", () => {
    expect(isWorkingDay("2026-07-20", calendar)).toBe(false);
    expect(addBusinessMinutes(new Date("2026-07-17T16:00:00.000Z"), 120, calendar).toISOString()).toBe(
      "2026-07-21T10:00:00.000Z",
    );
  });

  it("subtracts across non-working days", () => {
    expect(
      subtractBusinessMinutes(
        new Date("2026-07-21T10:00:00.000Z"),
        120,
        calendar,
      ).toISOString(),
    ).toBe("2026-07-17T16:00:00.000Z");
  });

  it("counts business minutes between instants", () => {
    expect(
      businessMinutesBetween(
        new Date("2026-07-17T16:00:00.000Z"),
        new Date("2026-07-21T10:00:00.000Z"),
        calendar,
      ),
    ).toBe(120);
    expect(
      businessMinutesBetween(
        new Date("2026-07-17T16:00:00.000Z"),
        new Date("2026-07-20T12:00:00.000Z"),
        calendar,
      ),
    ).toBe(60);
  });
});

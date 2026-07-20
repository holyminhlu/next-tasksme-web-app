import { Temporal } from "@js-temporal/polyfill";

export type RecurrenceSchedule = {
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  interval?: number;
  daysOfWeek?: number[];
  dayOfMonth?: number | null;
  timezone: string;
  startAt: Date | string;
  endAt?: Date | string | null;
};

function instant(value: Date | string): Temporal.Instant {
  return Temporal.Instant.from(value instanceof Date ? value.toISOString() : value);
}

function zoned(value: Date | string, timezone: string): Temporal.ZonedDateTime {
  return instant(value).toZonedDateTimeISO(timezone);
}

function toDate(value: Temporal.ZonedDateTime): Date {
  return new Date(value.toInstant().epochMilliseconds);
}

function jsDay(value: Temporal.ZonedDateTime): number {
  return value.dayOfWeek % 7;
}

function monthlyCandidate(
  base: Temporal.ZonedDateTime,
  months: number,
  dayOfMonth: number,
): Temporal.ZonedDateTime {
  const month = base.add({ months }).with({ day: 1 });
  return month.with({ day: Math.min(dayOfMonth, month.daysInMonth) });
}

export function computeNextRunAt(
  schedule: RecurrenceSchedule,
  after: Date | string = new Date(),
): Date | null {
  const interval = Math.max(1, Math.trunc(schedule.interval ?? 1));
  const start = zoned(schedule.startAt, schedule.timezone);
  const afterZoned = zoned(after, schedule.timezone);
  const exclusiveAfter =
    Temporal.ZonedDateTime.compare(start, afterZoned) > 0 ? start.subtract({ nanoseconds: 1 }) : afterZoned;
  let candidate: Temporal.ZonedDateTime;

  if (schedule.frequency === "DAILY") {
    candidate = start;
    if (Temporal.ZonedDateTime.compare(candidate, exclusiveAfter) <= 0) {
      const elapsedDays = start.toPlainDate().until(exclusiveAfter.toPlainDate()).days;
      candidate = start.add({ days: Math.max(0, Math.floor(elapsedDays / interval) * interval) });
      while (Temporal.ZonedDateTime.compare(candidate, exclusiveAfter) <= 0) {
        candidate = candidate.add({ days: interval });
      }
    }
  } else if (schedule.frequency === "WEEKLY") {
    const days = [...new Set(schedule.daysOfWeek ?? [jsDay(start)])]
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      .sort((a, b) => a - b);
    if (days.length === 0) return null;
    candidate = start;
    const maxDays = 7 * interval * 1000;
    let checked = 0;
    while (checked <= maxDays) {
      const daysSinceStart = start.toPlainDate().until(candidate.toPlainDate()).days;
      const eligibleWeek = Math.floor(daysSinceStart / 7) % interval === 0;
      if (
        eligibleWeek &&
        days.includes(jsDay(candidate)) &&
        Temporal.ZonedDateTime.compare(candidate, exclusiveAfter) > 0
      ) {
        break;
      }
      candidate = candidate.add({ days: 1 });
      checked += 1;
    }
    if (checked > maxDays) return null;
  } else {
    const targetDay = Math.max(1, Math.min(31, schedule.dayOfMonth ?? start.day));
    candidate = monthlyCandidate(start, 0, targetDay);
    if (Temporal.ZonedDateTime.compare(candidate, start) < 0) {
      candidate = monthlyCandidate(start, interval, targetDay);
    }
    while (Temporal.ZonedDateTime.compare(candidate, exclusiveAfter) <= 0) {
      candidate = monthlyCandidate(candidate, interval, targetDay);
    }
  }

  const result = toDate(candidate);
  const end = schedule.endAt ? instant(schedule.endAt) : null;
  return end && Temporal.Instant.compare(candidate.toInstant(), end) > 0 ? null : result;
}

export function previewNextRuns(
  schedule: RecurrenceSchedule,
  count = 10,
  after: Date | string = new Date(),
): Date[] {
  const runs: Date[] = [];
  let cursor = after;
  for (let index = 0; index < Math.max(0, count); index += 1) {
    const next = computeNextRunAt(schedule, cursor);
    if (!next) break;
    runs.push(next);
    cursor = next;
  }
  return runs;
}

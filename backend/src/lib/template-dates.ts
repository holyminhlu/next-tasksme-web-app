import { Temporal } from "@js-temporal/polyfill";

/** Adds calendar days in the workspace timezone, preserving local wall-clock time across DST. */
export function addWorkspaceCalendarDays(date: Date, days: number, timezone: string): Date {
  if (!Number.isInteger(days)) throw new TypeError("days must be an integer");
  try {
    const instant = Temporal.Instant.fromEpochMilliseconds(date.getTime());
    const shifted = instant.toZonedDateTimeISO(timezone).add({ days });
    return new Date(shifted.epochMilliseconds);
  } catch (error) {
    throw new RangeError(
      `Invalid date or workspace timezone "${timezone}": ${
        error instanceof Error ? error.message : "unknown error"
      }`,
      { cause: error },
    );
  }
}

/** Resolves an offset from a project start without using fixed 24-hour arithmetic. */
export function templateOffsetDate(
  projectStart: Date,
  offsetDays: number | null | undefined,
  timezone: string,
): Date | null {
  return offsetDays == null ? null : addWorkspaceCalendarDays(projectStart, offsetDays, timezone);
}

export function taskTemplateDates(params: {
  projectStart: Date;
  timezone: string;
  startOffsetDays?: number | null;
  dueOffsetDays?: number | null;
  durationDays?: number | null;
}): { startAt: Date | null; dueDate: Date | null } {
  const startAt = templateOffsetDate(
    params.projectStart,
    params.startOffsetDays,
    params.timezone,
  );
  const dueDate =
    params.dueOffsetDays != null
      ? templateOffsetDate(params.projectStart, params.dueOffsetDays, params.timezone)
      : startAt && params.durationDays != null
        ? addWorkspaceCalendarDays(startAt, params.durationDays, params.timezone)
        : null;
  return { startAt, dueDate };
}

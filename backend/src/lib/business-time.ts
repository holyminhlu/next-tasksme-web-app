import { Temporal } from "@js-temporal/polyfill";

export type BusinessCalendarInput = {
  timezone: string;
  workingHours: Array<{ dayOfWeek: number; startMinute: number; endMinute: number }>;
  holidays?: Array<{ date: Date | string; isWorking?: boolean }>;
};

function dateKey(value: Date | string, timezone: string): string {
  if (value instanceof Date) {
    return Temporal.Instant.from(value.toISOString()).toZonedDateTimeISO(timezone).toPlainDate().toString();
  }
  return value.length === 10
    ? value
    : Temporal.Instant.from(value).toZonedDateTimeISO(timezone).toPlainDate().toString();
}

function holidayFor(date: Temporal.PlainDate, calendar: BusinessCalendarInput) {
  return calendar.holidays?.find(
    (holiday) => dateKey(holiday.date, calendar.timezone) === date.toString(),
  );
}

export function isWorkingDay(
  date: Date | string | Temporal.PlainDate,
  calendar: BusinessCalendarInput,
): boolean {
  const plain =
    date instanceof Temporal.PlainDate
      ? date
      : dateKey(date, calendar.timezone);
  const plainDate = typeof plain === "string" ? Temporal.PlainDate.from(plain) : plain;
  const holiday = holidayFor(plainDate, calendar);
  if (holiday) return holiday.isWorking === true;
  const day = plainDate.dayOfWeek % 7;
  return calendar.workingHours.some(
    (hours) => hours.dayOfWeek === day && hours.endMinute > hours.startMinute,
  );
}

export function getWorkingHoursForDay(
  date: Temporal.PlainDate,
  calendar: BusinessCalendarInput,
): { startMinute: number; endMinute: number } | null {
  if (!isWorkingDay(date, calendar)) return null;
  const day = date.dayOfWeek % 7;
  return (
    calendar.workingHours.find(
      (hours) => hours.dayOfWeek === day && hours.endMinute > hours.startMinute,
    ) ?? null
  );
}

function atMinute(
  date: Temporal.PlainDate,
  minute: number,
  timezone: string,
): Temporal.ZonedDateTime {
  return date
    .toPlainDateTime({
      hour: Math.floor(minute / 60),
      minute: minute % 60,
    })
    .toZonedDateTime(timezone);
}

export function addBusinessMinutes(
  from: Date,
  minutes: number,
  calendar: BusinessCalendarInput,
): Date {
  if (minutes < 0) return subtractBusinessMinutes(from, -minutes, calendar);
  let remaining = Math.trunc(minutes);
  let cursor = Temporal.Instant.from(from.toISOString()).toZonedDateTimeISO(calendar.timezone);
  if (remaining === 0) return from;

  for (let guard = 0; guard < 36600; guard += 1) {
    const hours = getWorkingHoursForDay(cursor.toPlainDate(), calendar);
    if (hours) {
      const start = atMinute(cursor.toPlainDate(), hours.startMinute, calendar.timezone);
      const end = atMinute(cursor.toPlainDate(), hours.endMinute, calendar.timezone);
      if (Temporal.ZonedDateTime.compare(cursor, start) < 0) cursor = start;
      if (Temporal.ZonedDateTime.compare(cursor, end) < 0) {
        const available = Math.floor(cursor.until(end).total({ unit: "minutes" }));
        if (remaining <= available) {
          return new Date(cursor.add({ minutes: remaining }).toInstant().epochMilliseconds);
        }
        remaining -= available;
      }
    }
    cursor = cursor.toPlainDate().add({ days: 1 }).toPlainDateTime().toZonedDateTime(calendar.timezone);
  }
  throw new RangeError("Unable to find business time within 100 years");
}

export function subtractBusinessMinutes(
  from: Date,
  minutes: number,
  calendar: BusinessCalendarInput,
): Date {
  if (minutes < 0) return addBusinessMinutes(from, -minutes, calendar);
  let remaining = Math.trunc(minutes);
  let cursor = Temporal.Instant.from(from.toISOString()).toZonedDateTimeISO(calendar.timezone);
  if (remaining === 0) return from;

  for (let guard = 0; guard < 36600; guard += 1) {
    const hours = getWorkingHoursForDay(cursor.toPlainDate(), calendar);
    if (hours) {
      const start = atMinute(cursor.toPlainDate(), hours.startMinute, calendar.timezone);
      const end = atMinute(cursor.toPlainDate(), hours.endMinute, calendar.timezone);
      if (Temporal.ZonedDateTime.compare(cursor, end) > 0) cursor = end;
      if (Temporal.ZonedDateTime.compare(cursor, start) > 0) {
        const available = Math.floor(start.until(cursor).total({ unit: "minutes" }));
        if (remaining <= available) {
          return new Date(cursor.subtract({ minutes: remaining }).toInstant().epochMilliseconds);
        }
        remaining -= available;
      }
    }
    const previous = cursor.toPlainDate().subtract({ days: 1 });
    cursor = previous.toPlainDateTime({ hour: 23, minute: 59, second: 59 }).toZonedDateTime(
      calendar.timezone,
    );
  }
  throw new RangeError("Unable to find business time within 100 years");
}

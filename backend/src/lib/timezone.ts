export function formatYmd(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function todayYmd(timeZone: string, reference = new Date()): string {
  return formatYmd(reference, timeZone);
}

export function isValidIanaTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

function getTimeZoneOffsetMs(timeZone: string, date: Date): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

export function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offset = getTimeZoneOffsetMs(timeZone, utcGuess);
  return new Date(utcGuess.getTime() - offset);
}

export function startOfDayInTimezone(ymd: string, timeZone: string): Date {
  const [year, month, day] = ymd.split("-").map(Number);
  return zonedDateTimeToUtc(year, month, day, 0, 0, 0, timeZone);
}

export const startOfDayUtc = startOfDayInTimezone;

export function endOfDayInTimezone(ymd: string, timeZone: string): Date {
  const [year, month, day] = ymd.split("-").map(Number);
  return zonedDateTimeToUtc(year, month, day, 23, 59, 59, timeZone);
}

export const endOfDayUtc = endOfDayInTimezone;

export function addCalendarDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function defaultDashboardRange(timeZone: string, reference = new Date()) {
  const to = formatYmd(reference, timeZone);
  const localParts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
  }).formatToParts(reference);
  const year = Number(
    localParts.find((part) => part.type === "year")?.value ?? reference.getUTCFullYear(),
  );
  const month = Number(
    localParts.find((part) => part.type === "month")?.value ?? reference.getUTCMonth() + 1,
  );
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  return { from, to };
}

export function resolveDashboardRange(
  input: { from?: string; to?: string; timezone: string },
  reference = new Date(),
) {
  const defaults = defaultDashboardRange(input.timezone, reference);
  const from = input.from ?? defaults.from;
  const to = input.to ?? defaults.to;
  return {
    from,
    to,
    fromInstant: startOfDayInTimezone(from, input.timezone),
    toInstant: endOfDayInTimezone(to, input.timezone),
    todayStart: startOfDayInTimezone(formatYmd(reference, input.timezone), input.timezone),
    todayEnd: endOfDayInTimezone(formatYmd(reference, input.timezone), input.timezone),
  };
}

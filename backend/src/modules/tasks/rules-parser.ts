import {
  addCalendarDays,
  formatYmd,
  todayYmd,
  zonedDateTimeToUtc,
} from "../../lib/timezone.js";

type ParseContext = {
  text: string;
  locale: string;
  timezone: string;
  referenceDate: Date;
};

export type ParsedDraft = {
  title: string;
  description?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate?: Date | null;
  projectHint?: string;
  assigneeHint?: string;
  missingFields: string[];
  ambiguities: string[];
};

const PRIORITY_PATTERNS: Array<{
  pattern: RegExp;
  priority: NonNullable<ParsedDraft["priority"]>;
}> = [
  { pattern: /\b(urgent|asap|khẩn\s*cấp|gấp)\b/iu, priority: "URGENT" },
  {
    pattern: /\b(high\s*priority|priority\s*:\s*high|ưu\s*tiên\s*cao)\b/iu,
    priority: "HIGH",
  },
  {
    pattern: /\b(low\s*priority|priority\s*:\s*low|ưu\s*tiên\s*thấp)\b/iu,
    priority: "LOW",
  },
  {
    pattern:
      /\b(medium\s*priority|priority\s*:\s*medium|ưu\s*tiên\s*trung\s*bình)\b/iu,
    priority: "MEDIUM",
  },
];

const WEEKDAY_EN: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function weekdayJs(ymd: string, timeZone: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  const noon = zonedDateTimeToUtc(y!, m!, d!, 12, 0, 0, timeZone);
  const local = formatYmd(noon, timeZone);
  const [ly, lm, ld] = local.split("-").map(Number);
  return new Date(Date.UTC(ly!, lm! - 1, ld!)).getUTCDay();
}

function daysUntilWeekday(
  referenceYmd: string,
  targetJs: number,
  timeZone: string,
  forceNext: boolean,
): number {
  const current = weekdayJs(referenceYmd, timeZone);
  const delta = (targetJs - current + 7) % 7;
  if (delta === 0) {
    return forceNext ? 7 : 0;
  }
  return delta;
}

function resolveDueYmd(
  text: string,
  referenceYmd: string,
  timeZone: string,
): string | null {
  if (/\b(today|hôm\s*nay|hom\s*nay)\b/iu.test(text)) {
    return referenceYmd;
  }
  if (/\b(tomorrow|ngày\s*mai|ngay\s*mai)\b/iu.test(text)) {
    return addCalendarDays(referenceYmd, 1);
  }

  const nextEn = text.match(
    /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/iu,
  );
  if (nextEn) {
    const target = WEEKDAY_EN[nextEn[1]!.toLowerCase()]!;
    return addCalendarDays(
      referenceYmd,
      daysUntilWeekday(referenceYmd, target, timeZone, true),
    );
  }

  const enDay = text.match(
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/iu,
  );
  if (enDay) {
    const target = WEEKDAY_EN[enDay[1]!.toLowerCase()]!;
    return addCalendarDays(
      referenceYmd,
      daysUntilWeekday(referenceYmd, target, timeZone, false),
    );
  }

  const forceNext = /\b(tuần\s*sau|tuan\s*sau)\b/iu.test(text);
  const viMap: Array<{ pattern: RegExp; target: number }> = [
    { pattern: /\b(chủ\s*nhật|chu\s*nhat)\b/iu, target: 0 },
    { pattern: /\b(thứ\s*bảy|thu\s*bay|thứ\s*7|thu\s*7)\b/iu, target: 6 },
    { pattern: /\b(thứ\s*sáu|thu\s*sau|thứ\s*6|thu\s*6)\b/iu, target: 5 },
    { pattern: /\b(thứ\s*năm|thu\s*nam|thứ\s*5|thu\s*5)\b/iu, target: 4 },
    { pattern: /\b(thứ\s*tư|thu\s*tu|thứ\s*4|thu\s*4)\b/iu, target: 3 },
    { pattern: /\b(thứ\s*ba|thu\s*ba|thứ\s*3|thu\s*3)\b/iu, target: 2 },
    { pattern: /\b(thứ\s*hai|thu\s*hai|thứ\s*2|thu\s*2)\b/iu, target: 1 },
  ];
  for (const item of viMap) {
    if (item.pattern.test(text)) {
      return addCalendarDays(
        referenceYmd,
        daysUntilWeekday(referenceYmd, item.target, timeZone, forceNext),
      );
    }
  }

  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  return iso?.[1] ?? null;
}

/**
 * Deterministic Vietnamese + English NL parser. Never returns DB IDs.
 */
export function parseTaskText(context: ParseContext): ParsedDraft {
  const { text, timezone } = context;
  const referenceYmd =
    context.referenceDate && !Number.isNaN(context.referenceDate.getTime())
      ? formatYmd(context.referenceDate, timezone)
      : todayYmd(timezone);

  const missingFields: string[] = [];
  const ambiguities: string[] = [];
  let working = text.trim();

  let priority: ParsedDraft["priority"];
  for (const item of PRIORITY_PATTERNS) {
    if (item.pattern.test(working)) {
      priority = item.priority;
      working = working.replace(item.pattern, " ");
      break;
    }
  }

  let assigneeHint: string | undefined;
  const atMatch = working.match(/@([^\s@#,;]+)/u);
  if (atMatch) {
    assigneeHint = atMatch[1]!.trim();
    working = working.replace(atMatch[0], " ");
  }

  let projectHint: string | undefined;
  const hashMatch = working.match(/#([^\s@#,;]+)/u);
  if (hashMatch) {
    projectHint = hashMatch[1]!.trim();
    working = working.replace(hashMatch[0], " ");
  }

  const dueYmd = resolveDueYmd(text, referenceYmd, timezone);
  let dueDate: Date | null = null;
  if (dueYmd) {
    const [y, m, d] = dueYmd.split("-").map(Number);
    dueDate = zonedDateTimeToUtc(y!, m!, d!, 17, 0, 0, timezone);
  } else if (/\b(due|deadline|hạn|hết\s*hạn)\b/iu.test(text)) {
    missingFields.push("dueDate");
    ambiguities.push("Could not resolve the due date from the text.");
  }

  working = working
    .replace(/\b(today|tomorrow|hôm\s*nay|hom\s*nay|ngày\s*mai|ngay\s*mai)\b/giu, " ")
    .replace(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/giu, " ")
    .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/giu, " ")
    .replace(/\b(tuần\s*sau|tuan\s*sau)\b/giu, " ")
    .replace(/\b(chủ\s*nhật|chu\s*nhat)\b/giu, " ")
    .replace(
      /\b(thứ\s*(hai|ba|tư|tu|năm|nam|sáu|sau|bảy|bay|[2-7])|thu\s*(hai|ba|tu|nam|sau|bay|[2-7]))\b/giu,
      " ",
    )
    .replace(/\b(20\d{2}-\d{2}-\d{2})\b/g, " ")
    .replace(/\b(due|deadline|hạn|hết\s*hạn)\s*:?\s*/giu, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const title = (working || text.trim()).slice(0, 200);
  if (!title.trim()) {
    missingFields.push("title");
  }

  return {
    title,
    priority,
    dueDate,
    projectHint,
    assigneeHint,
    missingFields,
    ambiguities,
  };
}

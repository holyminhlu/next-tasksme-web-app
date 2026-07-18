import { getEnv } from "../../config/env.js";
import { prisma } from "../../config/database.js";
import { logger } from "../../config/logger.js";
import {
  formatYmd,
  startOfDayInTimezone,
  todayYmd,
} from "../../lib/timezone.js";
import { parseTaskText as parseTaskRules, type ParsedDraft } from "./rules-parser.js";
import type { ParseTaskInput } from "./tasks.schemas.js";

export type ParseTaskResult = {
  draft: {
    title: string;
    description?: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    status: "TODO";
    dueDate?: string | null;
    dueDateLabel?: string | null;
    projectName?: string | null;
    assigneeName?: string | null;
  };
  missingFields: string[];
  ambiguities: string[];
  projectCandidates: Array<{ id: string; name: string }>;
  assigneeCandidates: Array<{ id: string; fullName: string; email: string }>;
  parseMeta: {
    engine: "rules" | "rules+ai";
    locale: string;
    timezone: string;
    referenceDate: string;
  };
};

type AiDraft = {
  title?: string;
  description?: string;
  priority?: string;
  dueDateHint?: string;
  projectName?: string;
  assigneeName?: string;
};

async function enhanceWithGemini(
  text: string,
  locale: string,
  timezone: string,
  referenceDate: string,
  rules: ParsedDraft,
): Promise<AiDraft | null> {
  const env = getEnv();
  if (!env.GEMINI_API_KEY) {
    return null;
  }

  const model = env.GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: [
                  "Extract a task draft from the user text.",
                  "Never invent database IDs. Only names and dates.",
                  `Locale: ${locale}. Timezone: ${timezone}. Reference date: ${referenceDate}.`,
                  `Rules draft already found: ${JSON.stringify(rules)}.`,
                  `User text: ${text}`,
                ].join("\n"),
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      }),
    });
    if (!response.ok) {
      logger.warn(
        { status: response.status },
        "Gemini parse enhancement failed",
      );
      return null;
    }
    const json = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as AiDraft;
  } catch (error) {
    logger.warn({ err: error }, "Gemini parse enhancement error");
    return null;
  }
}

function resolveReferenceDate(
  input: ParseTaskInput,
  timezone: string,
): { ymd: string; date: Date } {
  if (!input.referenceDate) {
    const ymd = todayYmd(timezone);
    return { ymd, date: startOfDayInTimezone(ymd, timezone) };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(input.referenceDate)) {
    return {
      ymd: input.referenceDate,
      date: startOfDayInTimezone(input.referenceDate, timezone),
    };
  }
  const date = new Date(input.referenceDate);
  return { ymd: formatYmd(date, timezone), date };
}

export async function parseTaskText(
  workspaceId: string,
  input: ParseTaskInput,
  workspaceDefaults: { timezone: string; locale: string },
): Promise<ParseTaskResult> {
  const timezone = input.timezone ?? workspaceDefaults.timezone ?? "UTC";
  const locale = input.locale ?? workspaceDefaults.locale ?? "vi";
  const reference = resolveReferenceDate(input, timezone);

  let rules = parseTaskRules({
    text: input.text,
    locale,
    timezone,
    referenceDate: reference.date,
  });

  let engine: "rules" | "rules+ai" = "rules";
  const ai = await enhanceWithGemini(
    input.text,
    locale,
    timezone,
    reference.ymd,
    rules,
  );

  if (ai) {
    engine = "rules+ai";
    if (ai.title?.trim()) {
      rules = { ...rules, title: ai.title.trim().slice(0, 200) };
    }
    if (ai.description?.trim()) {
      rules = { ...rules, description: ai.description.trim().slice(0, 5000) };
    }
    if (
      ai.priority &&
      ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(ai.priority) &&
      !rules.priority
    ) {
      rules = {
        ...rules,
        priority: ai.priority as ParsedDraft["priority"],
      };
    }
    if (ai.projectName?.trim() && !rules.projectHint) {
      rules = { ...rules, projectHint: ai.projectName.trim() };
    }
    if (ai.assigneeName?.trim() && !rules.assigneeHint) {
      rules = { ...rules, assigneeHint: ai.assigneeName.trim() };
    }
    if (ai.dueDateHint?.trim() && !rules.dueDate) {
      const fromAi = parseTaskRules({
        text: ai.dueDateHint,
        locale,
        timezone,
        referenceDate: reference.date,
      });
      if (fromAi.dueDate) {
        rules = { ...rules, dueDate: fromAi.dueDate };
      }
    }
  }

  const [projects, members] = await Promise.all([
    rules.projectHint
      ? prisma.project.findMany({
          where: {
            workspaceId,
            deletedAt: null,
            name: {
              contains: rules.projectHint,
              mode: "insensitive",
            },
          },
          select: { id: true, name: true },
          take: 10,
          orderBy: { name: "asc" },
        })
      : Promise.resolve([] as Array<{ id: string; name: string }>),
    rules.assigneeHint
      ? prisma.workspaceMember.findMany({
          where: {
            workspaceId,
            deletedAt: null,
            status: "ACTIVE",
            user: {
              OR: [
                {
                  fullName: {
                    contains: rules.assigneeHint,
                    mode: "insensitive",
                  },
                },
                {
                  email: {
                    contains: rules.assigneeHint,
                    mode: "insensitive",
                  },
                },
              ],
            },
          },
          take: 10,
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve(
          [] as Array<{
            user: { id: string; fullName: string; email: string };
          }>,
        ),
  ]);

  const projectCandidates = projects.map((p) => ({ id: p.id, name: p.name }));
  const assigneeCandidates = members.map((m) => ({
    id: m.user.id,
    fullName: m.user.fullName,
    email: m.user.email,
  }));

  const ambiguities = [...rules.ambiguities];
  if (rules.projectHint && projectCandidates.length > 1) {
    ambiguities.push("project");
  }
  if (rules.assigneeHint && assigneeCandidates.length > 1) {
    ambiguities.push("assignee");
  }
  if (rules.projectHint && projectCandidates.length === 0) {
    ambiguities.push("project_unresolved");
  }
  if (rules.assigneeHint && assigneeCandidates.length === 0) {
    ambiguities.push("assignee_unresolved");
  }

  const missingFields = [...rules.missingFields];
  if (!rules.title.trim() && !missingFields.includes("title")) {
    missingFields.push("title");
  }

  return {
    draft: {
      title: rules.title,
      description: rules.description,
      priority: rules.priority ?? "MEDIUM",
      status: "TODO",
      dueDate: rules.dueDate ? rules.dueDate.toISOString() : null,
      dueDateLabel: rules.dueDate ? formatYmd(rules.dueDate, timezone) : null,
      projectName: rules.projectHint ?? null,
      assigneeName: rules.assigneeHint ?? null,
    },
    missingFields,
    ambiguities,
    projectCandidates,
    assigneeCandidates,
    parseMeta: {
      engine,
      locale,
      timezone,
      referenceDate: reference.ymd,
    },
  };
}

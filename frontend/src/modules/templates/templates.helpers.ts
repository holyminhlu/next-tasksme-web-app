import type {
  CloneJobRecord,
  TemplateContentV2,
  TemplateListResult,
  TemplateRecord,
} from "./templates.types";

const TEMPLATE_STATUSES = new Set(["DRAFT", "PUBLISHED", "ARCHIVED"]);
const TEMPLATE_VISIBILITIES = new Set(["WORKSPACE", "SYSTEM"]);
const CLONE_STATUSES = new Set([
  "PENDING", "PROCESSING", "RETRY_WAIT", "COMPLETED", "FAILED", "DEAD", "CANCELLED",
]);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function mapTemplate(raw: unknown): TemplateRecord | null {
  const item = record(raw);
  const content = record(item?.contentJson);
  if (
    !item ||
    typeof item.id !== "string" ||
    typeof item.seriesId !== "string" ||
    typeof item.name !== "string" ||
    !TEMPLATE_STATUSES.has(String(item.status)) ||
    !TEMPLATE_VISIBILITIES.has(String(item.visibility)) ||
    content?.schemaVersion !== 2
  ) return null;

  return {
    id: item.id,
    seriesId: item.seriesId,
    workspaceId: nullableString(item.workspaceId),
    name: item.name,
    description: nullableString(item.description),
    industryCode: nullableString(item.industryCode),
    version: Number(item.version ?? 0),
    visibility: item.visibility as TemplateRecord["visibility"],
    status: item.status as TemplateRecord["status"],
    contentSchemaVersion: Number(item.contentSchemaVersion ?? 0),
    contentHash: String(item.contentHash ?? ""),
    contentJson: content as TemplateContentV2,
    publishedAt: nullableString(item.publishedAt),
    supersededAt: nullableString(item.supersededAt),
    createdById: nullableString(item.createdById),
    createdAt: String(item.createdAt ?? ""),
    updatedAt: String(item.updatedAt ?? ""),
  };
}

export function mapTemplateList(data: unknown, meta?: unknown): TemplateListResult | null {
  if (!Array.isArray(data)) return null;
  const items = data.map(mapTemplate);
  if (items.some((item) => item === null)) return null;
  const pagination = record(record(meta)?.pagination) ?? {};
  const page = Number(pagination.page ?? 1);
  const pageSize = Number(pagination.pageSize ?? Math.max(1, data.length));
  const total = Number(pagination.total ?? data.length);
  return {
    items: items as TemplateRecord[],
    page,
    pageSize,
    total,
    totalPages: Number(pagination.totalPages ?? Math.max(1, Math.ceil(total / pageSize))),
  };
}

export function mapCloneJob(raw: unknown): CloneJobRecord | null {
  const item = record(raw);
  if (!item || typeof item.id !== "string" || !CLONE_STATUSES.has(String(item.status))) return null;
  return {
    id: item.id,
    templateId: String(item.templateId ?? ""),
    projectId: nullableString(item.projectId),
    status: item.status as CloneJobRecord["status"],
    progress: Number(item.progress ?? 0),
    attempts: Number(item.attempts ?? 0),
    maxAttempts: Number(item.maxAttempts ?? 0),
    nextAttemptAt: nullableString(item.nextAttemptAt),
    errorMessage: nullableString(item.errorMessage),
    resultJson: item.resultJson,
    createdAt: String(item.createdAt ?? ""),
    completedAt: nullableString(item.completedAt),
  };
}

export type CloneJobDisposition = "poll" | "completed" | "retryable" | "stopped";

export function cloneJobDisposition(status: CloneJobRecord["status"]): CloneJobDisposition {
  if (status === "COMPLETED") return "completed";
  if (status === "FAILED" || status === "DEAD") return "retryable";
  if (status === "CANCELLED") return "stopped";
  return "poll";
}

export function clonePollDelay(attempt: number, hidden = false): number {
  const delay = Math.min(15_000, 1_500 * 2 ** Math.min(3, Math.max(0, attempt)));
  return hidden ? Math.max(10_000, delay) : delay;
}

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function getOrCreateIdempotencyKey(
  storage: StorageLike,
  scope: string,
  create: () => string,
): string {
  const storageKey = `template-clone-key:${scope}`;
  const existing = storage.getItem(storageKey);
  if (existing) return existing;
  const key = create();
  storage.setItem(storageKey, key);
  return key;
}

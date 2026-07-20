import type {
  AutomationJobType,
  AutomationRun,
  Prisma,
} from "../../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import { writeAuditLog } from "../../services/audit.service.js";

export type CreateAutomationRunInput = {
  workspaceId: string;
  taskId?: string | null;
  jobType: AutomationJobType;
  idempotencyKey: string;
  correlationId?: string | null;
  payload?: Prisma.InputJsonValue;
  maxAttempts?: number;
};

export async function upsertAutomationRun(input: CreateAutomationRunInput) {
  return prisma.automationRun.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    update: {},
    create: {
      workspaceId: input.workspaceId,
      taskId: input.taskId,
      jobType: input.jobType,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      payloadJson: input.payload ?? {},
      maxAttempts: input.maxAttempts ?? 5,
    },
  });
}

export async function claimDueAutomationRuns(limit: number, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<AutomationRun[]>`
      SELECT *
      FROM "automation_runs"
      WHERE (
        ("status" = 'PENDING' AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= ${now}))
        OR ("status" = 'FAILED' AND "nextRetryAt" <= ${now})
      )
      AND "attempts" < "maxAttempts"
      ORDER BY COALESCE("nextRetryAt", "createdAt") ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    `;
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    await tx.automationRun.updateMany({
      where: { id: { in: ids } },
      data: {
        status: "RUNNING",
        attempts: { increment: 1 },
        startedAt: now,
        completedAt: null,
        errorMessage: null,
      },
    });
    return tx.automationRun.findMany({ where: { id: { in: ids } } });
  });
}

export async function markAutomationRunSucceeded(
  id: string,
  result: Prisma.InputJsonValue = {},
) {
  return prisma.automationRun.update({
    where: { id },
    data: {
      status: "SUCCEEDED",
      resultJson: result,
      completedAt: new Date(),
      nextRetryAt: null,
      errorMessage: null,
    },
  });
}

export async function markAutomationRunFailed(id: string, error: unknown) {
  const run = await prisma.automationRun.findUnique({ where: { id } });
  if (!run) throw new NotFoundError("Automation run not found");
  const dead = run.attempts >= run.maxAttempts;
  const delay = Math.min(60 * 60_000, 2 ** Math.max(0, run.attempts - 1) * 5_000);
  return prisma.automationRun.update({
    where: { id },
    data: {
      status: dead ? "DEAD" : "FAILED",
      errorMessage: error instanceof Error ? error.message : String(error),
      completedAt: new Date(),
      nextRetryAt: dead ? null : new Date(Date.now() + delay),
    },
  });
}

export async function markAutomationRunDead(id: string, errorMessage?: string) {
  return prisma.automationRun.update({
    where: { id },
    data: {
      status: "DEAD",
      errorMessage,
      completedAt: new Date(),
      nextRetryAt: null,
    },
  });
}

export class AutomationRunsService {
  async list(
    workspaceId: string,
    query: { page: number; pageSize: number; status?: string; taskId?: string },
  ) {
    const where = {
      workspaceId,
      ...(query.status ? { status: query.status as AutomationRun["status"] } : {}),
      ...(query.taskId ? { taskId: query.taskId } : {}),
    };
    const [total, items] = await Promise.all([
      prisma.automationRun.count({ where }),
      prisma.automationRun.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      items,
      total,
      pagination: { page: query.page, pageSize: query.pageSize, total },
    };
  }

  async get(workspaceId: string, id: string) {
    const run = await prisma.automationRun.findFirst({ where: { id, workspaceId } });
    if (!run) throw new NotFoundError("Automation run not found");
    return run;
  }

  async retry(workspaceId: string, id: string, userId: string) {
    const run = await this.get(workspaceId, id);
    if (!["FAILED", "DEAD"].includes(run.status)) {
      throw new ConflictError("Only failed or dead automation runs can be retried");
    }
    const retried = await prisma.automationRun.update({
      where: { id },
      data: {
        status: "PENDING",
        attempts: 0,
        nextRetryAt: new Date(),
        completedAt: null,
        errorMessage: null,
        retriedById: userId,
      },
    });
    await writeAuditLog({
      action: "automation_run.retried",
      userId,
      workspaceId,
      entityType: "automation_run",
      entityId: id,
      metadata: { previousStatus: run.status },
    });
    return retried;
  }
}

export const automationRunsService = new AutomationRunsService();

import { randomUUID } from "node:crypto";
import { prisma } from "../../config/database.js";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import { materializeCloneJob } from "./template-clone.service.js";

const LEASE_MS = 5 * 60_000;
const MAX_BACKOFF_MS = 30 * 60_000;

export type ClaimedCloneJob = { id: string; leaseToken: string };

export async function claimPendingCloneJobs(
  limit: number,
  now = new Date(),
  workerId = `worker-${process.pid}`,
): Promise<ClaimedCloneJob[]> {
  const leaseExpiresAt = new Date(now.getTime() + LEASE_MS);
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "clone_jobs"
      WHERE (
        "status" = 'PENDING'
        OR ("status" = 'RETRY_WAIT' AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= ${now}))
        OR ("status" = 'PROCESSING' AND "leaseExpiresAt" < ${now})
      )
      ORDER BY COALESCE("nextAttemptAt", "createdAt"), "createdAt"
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    `;
    const claimed: ClaimedCloneJob[] = [];
    for (const row of rows) {
      const leaseToken = randomUUID();
      await tx.cloneJob.update({
        where: { id: row.id },
        data: {
          status: "PROCESSING",
          attempts: { increment: 1 },
          leaseToken,
          leasedBy: workerId,
          leasedAt: now,
          leaseExpiresAt,
          heartbeatAt: now,
          startedAt: now,
          nextAttemptAt: null,
          errorMessage: null,
        },
      });
      claimed.push({ id: row.id, leaseToken });
    }
    return claimed;
  });
}

export async function heartbeatCloneJob(
  id: string,
  leaseToken: string,
  progress: number,
  now = new Date(),
) {
  const updated = await prisma.cloneJob.updateMany({
    where: { id, status: "PROCESSING", leaseToken },
    data: {
      progress: Math.max(0, Math.min(99, Math.floor(progress))),
      heartbeatAt: now,
      leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
    },
  });
  return updated.count === 1;
}

function transient(error: unknown): boolean {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  return ["P1001", "P1002", "P1008", "P1017", "P2024", "ECONNRESET", "ETIMEDOUT"].includes(code);
}

export async function processCloneJob(claim: ClaimedCloneJob, now = new Date()) {
  const job = await prisma.cloneJob.findUnique({ where: { id: claim.id } });
  if (!job || job.status !== "PROCESSING" || job.leaseToken !== claim.leaseToken) return false;
  try {
    const result = await materializeCloneJob({
      cloneJobId: job.id,
      leaseToken: claim.leaseToken,
      onProgress: async (progress) => {
        if (!(await heartbeatCloneJob(job.id, claim.leaseToken, progress)))
          throw new ConflictError("Clone job lease was lost");
      },
    });
    const completed = await prisma.cloneJob.updateMany({
      where: { id: job.id, status: "PROCESSING", leaseToken: claim.leaseToken },
      data: {
        projectId: result.projectId,
        status: "COMPLETED",
        progress: 100,
        resultJson: result,
        completedAt: new Date(),
        leaseToken: null,
        leaseExpiresAt: null,
        errorMessage: null,
      },
    });
    return completed.count === 1;
  } catch (error) {
    const latest = await prisma.cloneJob.findUnique({ where: { id: job.id } });
    if (!latest || latest.leaseToken !== claim.leaseToken) return false;
    const shouldRetry = transient(error) && latest.attempts < latest.maxAttempts;
    const dead = transient(error) && latest.attempts >= latest.maxAttempts;
    const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.max(0, latest.attempts - 1));
    await prisma.cloneJob.updateMany({
      where: { id: job.id, status: "PROCESSING", leaseToken: claim.leaseToken },
      data: {
        status: shouldRetry ? "RETRY_WAIT" : dead ? "DEAD" : "FAILED",
        nextAttemptAt: shouldRetry ? new Date(now.getTime() + delay) : null,
        errorMessage: error instanceof Error ? error.message : "Clone failed",
        lastErrorCode: transient(error) ? "TRANSIENT" : "PERMANENT",
        lastErrorAt: new Date(),
        completedAt: shouldRetry ? null : new Date(),
        leaseToken: null,
        leaseExpiresAt: null,
      },
    });
    return false;
  }
}

export async function getCloneJob(workspaceId: string, cloneJobId: string) {
  const job = await prisma.cloneJob.findFirst({ where: { id: cloneJobId, workspaceId } });
  if (!job) throw new NotFoundError("Clone job not found");
  return {
    id: job.id,
    templateId: job.templateId,
    projectId: job.projectId,
    status: job.status,
    progress: job.progress,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    nextAttemptAt: job.nextAttemptAt?.toISOString() ?? null,
    errorMessage: job.errorMessage,
    resultJson: job.resultJson,
    createdAt: job.createdAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
  };
}

export async function retryCloneJob(workspaceId: string, cloneJobId: string) {
  const updated = await prisma.cloneJob.updateMany({
    where: { id: cloneJobId, workspaceId, status: { in: ["FAILED", "DEAD"] } },
    data: {
      status: "PENDING",
      attempts: 0,
      nextAttemptAt: null,
      completedAt: null,
      errorMessage: null,
      lastErrorCode: null,
      leaseToken: null,
      leaseExpiresAt: null,
    },
  });
  if (!updated.count) throw new ConflictError("Only failed or dead clone jobs can be retried");
  return getCloneJob(workspaceId, cloneJobId);
}

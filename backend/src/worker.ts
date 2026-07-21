import type { AutomationRun } from "../generated/prisma/client.js";
import { prisma } from "./config/database.js";
import { getEnv } from "./config/env.js";
import { logger } from "./config/logger.js";
import {
  claimDueAutomationRuns,
  markAutomationRunFailed,
  markAutomationRunSucceeded,
} from "./modules/automation/automation-runs.service.js";
import { generateDueOccurrences } from "./modules/recurrences/recurrences.service.js";
import { recalculateDueTaskRisks, recalculateTaskRisk } from "./modules/risk/risk.service.js";
import { processDueSlaNotifications } from "./modules/sla/sla.service.js";
import {
  claimPendingCloneJobs,
  processCloneJob,
} from "./modules/templates/clone-jobs.service.js";

const env = getEnv();
let stopping = false;

async function dueRecurrenceIds(limit: number, now: Date): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "task_recurrences"
      WHERE "isActive" = true AND "nextRunAt" <= ${now}
      ORDER BY "nextRunAt"
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    `;
    return rows.map((row) => row.id);
  });
}

function payload(run: AutomationRun): Record<string, unknown> {
  return run.payloadJson &&
    typeof run.payloadJson === "object" &&
    !Array.isArray(run.payloadJson)
    ? (run.payloadJson as Record<string, unknown>)
    : {};
}

async function executeRun(run: AutomationRun) {
  try {
    const data = payload(run);
    if (run.jobType === "RECURRENCE_GENERATE" && typeof data.recurrenceId === "string") {
      await generateDueOccurrences(data.recurrenceId);
    } else if (run.jobType === "RISK_RECALCULATE" && run.taskId) {
      await recalculateTaskRisk(run.taskId);
    }
    await markAutomationRunSucceeded(run.id, { processedAt: new Date().toISOString() });
  } catch (error) {
    await markAutomationRunFailed(run.id, error);
  }
}

export async function pollWorkerOnce(now = new Date()) {
  const recurrenceIds = await dueRecurrenceIds(env.WORKER_BATCH_SIZE, now);
  for (const id of recurrenceIds) {
    try {
      await generateDueOccurrences(id, now);
    } catch (error) {
      logger.error({ err: error, recurrenceId: id }, "recurrence generation failed");
    }
  }
  await recalculateDueTaskRisks(env.WORKER_BATCH_SIZE, now);
  await processDueSlaNotifications(env.WORKER_BATCH_SIZE, now);
  const cloneJobs = await claimPendingCloneJobs(Math.max(1, Math.floor(env.WORKER_BATCH_SIZE / 2)));
  for (const cloneJob of cloneJobs) {
    try {
      await processCloneJob(cloneJob);
    } catch (error) {
      logger.error({ err: error, cloneJobId: cloneJob.id }, "clone job failed");
    }
  }
  const runs = await claimDueAutomationRuns(env.WORKER_BATCH_SIZE, now);
  for (const run of runs) await executeRun(run);
}

async function main() {
  if (!env.WORKER_ENABLED) {
    logger.info("worker disabled");
    return;
  }
  logger.info("automation worker started");
  while (!stopping) {
    try {
      await pollWorkerOnce();
    } catch (error) {
      logger.error({ err: error }, "worker poll failed");
    }
    if (!stopping) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, env.WORKER_POLL_INTERVAL_MS);
        timer.unref();
      });
    }
  }
  await prisma.$disconnect();
  logger.info("automation worker stopped");
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopping = true;
  });
}

if (process.env.NODE_ENV !== "test") {
  void main();
}

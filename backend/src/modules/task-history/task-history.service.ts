import { prisma } from "../../config/database.js";
import { getVisibleTask, type TaskActor } from "../tasks/task-access.js";

export class TaskHistoryService {
  async list(workspaceId: string, taskId: string, actor: TaskActor) {
    const task = await getVisibleTask(workspaceId, taskId, actor, {
      includeArchived: true,
    });
    const rows = await prisma.taskStatusHistory.findMany({
      where: { taskId },
      orderBy: { changedAt: "asc" },
      include: {
        changedBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    const durationByStatus: Record<string, number> = {};
    for (const row of rows) {
      if (row.fromStatus && row.durationInPreviousStatus !== null) {
        durationByStatus[row.fromStatus] =
          (durationByStatus[row.fromStatus] ?? 0) +
          row.durationInPreviousStatus;
      }
    }
    const latest = rows.at(-1);
    if (latest && task.status !== "DONE" && task.status !== "CANCELLED") {
      const currentSeconds = Math.max(
        0,
        Math.floor((Date.now() - latest.changedAt.getTime()) / 1000),
      );
      durationByStatus[latest.toStatus] =
        (durationByStatus[latest.toStatus] ?? 0) + currentSeconds;
    }

    return {
      items: rows.map((row) => ({
        id: row.id,
        fromStatus: row.fromStatus,
        toStatus: row.toStatus,
        changedById: row.changedById,
        changedByName: row.changedBy?.fullName ?? null,
        changedAt: row.changedAt.toISOString(),
        durationInPreviousStatus: row.durationInPreviousStatus,
      })),
      durationByStatus,
      leadTimeSeconds: Math.max(
        0,
        Math.floor(
          ((task.status === "DONE" && latest
            ? latest.changedAt.getTime()
            : Date.now()) -
            (rows[0]?.changedAt.getTime() ?? Date.now())) /
            1000,
        ),
      ),
      cycleTimeSeconds:
        (durationByStatus.IN_PROGRESS ?? 0) +
        (durationByStatus.IN_REVIEW ?? 0) +
        (durationByStatus.BLOCKED ?? 0),
    };
  }
}

export const taskHistoryService = new TaskHistoryService();

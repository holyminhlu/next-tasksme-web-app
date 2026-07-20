import type { Prisma, TaskPriority, TaskStatus } from "../../generated/prisma/client.js";
import { prisma } from "../config/database.js";
import { nextRankAfter } from "../lib/rank.js";
import { recordActivity, taskActivityMetadata } from "./activity.service.js";
import { initializeTaskSla } from "../modules/sla/sla.service.js";

export type FactoryTaskInput = {
  workspaceId: string;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string | null;
  assigneeId?: string | null;
  createdById?: string | null;
  startAt?: Date | null;
  dueDate?: Date | null;
};

export async function createTaskFromFactory(input: FactoryTaskInput) {
  const warnings: string[] = [];
  let projectId = input.projectId ?? null;
  let assigneeId = input.assigneeId ?? null;
  if (
    projectId &&
    !(await prisma.project.findFirst({
      where: { id: projectId, workspaceId: input.workspaceId, deletedAt: null },
      select: { id: true },
    }))
  ) {
    warnings.push("Template project is no longer available; projectId was omitted");
    projectId = null;
  }
  if (
    assigneeId &&
    !(await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: input.workspaceId,
        userId: assigneeId,
        status: "ACTIVE",
        deletedAt: null,
      },
      select: { id: true },
    }))
  ) {
    warnings.push("Template assignee is no longer active; assigneeId was omitted");
    assigneeId = null;
  }
  if (projectId && assigneeId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { visibility: true, members: { where: { userId: assigneeId }, select: { id: true } } },
    });
    if (project?.visibility === "PRIVATE" && project.members.length === 0) {
      warnings.push("Template assignee cannot access the private project; assigneeId was omitted");
      assigneeId = null;
    }
  }

  const status = input.status ?? "TODO";
  const now = new Date();
  const task = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const counter = await tx.workspaceTaskCounter.upsert({
      where: { workspaceId: input.workspaceId },
      create: { workspaceId: input.workspaceId, nextNumber: 2 },
      update: { nextNumber: { increment: 1 } },
    });
    const last = await tx.task.findFirst({
      where: { workspaceId: input.workspaceId, projectId, status, deletedAt: null },
      orderBy: [{ rank: "desc" }, { taskNumber: "desc" }],
      select: { rank: true },
    });
    const created = await tx.task.create({
      data: {
        workspaceId: input.workspaceId,
        taskNumber: counter.nextNumber - 1,
        title: input.title,
        description: input.description,
        status,
        priority: input.priority ?? "MEDIUM",
        projectId,
        assigneeId,
        createdById: input.createdById,
        startAt: input.startAt,
        dueDate: input.dueDate,
        source: "RECURRING",
        rank: nextRankAfter(last?.rank),
        isBlocked: status === "BLOCKED",
        completedAt: status === "DONE" ? now : null,
        completedById: status === "DONE" ? input.createdById : null,
        riskRecalculateAt: now,
      },
    });
    await tx.taskStatusHistory.create({
      data: {
        taskId: created.id,
        fromStatus: null,
        toStatus: status,
        changedById: input.createdById,
        changedAt: now,
      },
    });
    if (assigneeId && assigneeId !== input.createdById) {
      const preference = await tx.notificationPreference.findUnique({
        where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: assigneeId } },
      });
      if (preference?.taskAssigned !== false) {
        await tx.notification.upsert({
          where: { dedupeKey: `task-assigned:${created.id}:${assigneeId}:${created.version}` },
          update: {},
          create: {
            workspaceId: input.workspaceId,
            userId: assigneeId,
            taskId: created.id,
            type: "TASK_ASSIGNED",
            title: `Task assigned: ${created.title}`,
            dedupeKey: `task-assigned:${created.id}:${assigneeId}:${created.version}`,
          },
        });
      }
    }
    return created;
  });
  await recordActivity({
    workspaceId: task.workspaceId,
    actorId: input.createdById,
    action: "task.created",
    resourceType: "task",
    resourceId: task.id,
    projectId: task.projectId,
    summary: `Created recurring task "${task.title}"`,
    metadata: taskActivityMetadata(task),
  });
  await initializeTaskSla(task);
  return { task, warnings };
}

export const taskFactoryService = { createTask: createTaskFromFactory };

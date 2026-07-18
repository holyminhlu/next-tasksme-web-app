import { prisma } from "../../config/database.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { recordActivity, ACTIVITY_ACTIONS } from "../../services/activity.service.js";
import {
  assertCanMutateTask,
  getVisibleTask,
  type TaskActor,
} from "../tasks/task-access.js";
import type {
  CreateChecklistItemInput,
  ReorderChecklistInput,
  UpdateChecklistItemInput,
} from "./checklist.schemas.js";

function mapItem(item: {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  position: number;
  completedById: string | null;
  completedAt: Date | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: item.id,
    taskId: item.taskId,
    title: item.title,
    isCompleted: item.isCompleted,
    position: item.position,
    completedById: item.completedById,
    completedAt: item.completedAt?.toISOString() ?? null,
    createdById: item.createdById,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export const checklistService = {
  async list(workspaceId: string, taskId: string, actor: TaskActor) {
    await getVisibleTask(workspaceId, taskId, actor);
    const items = await prisma.checklistItem.findMany({
      where: { taskId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    const completedCount = items.filter((item) => item.isCompleted).length;
    return {
      items: items.map(mapItem),
      progress: {
        completed: completedCount,
        total: items.length,
      },
    };
  },

  async create(
    workspaceId: string,
    taskId: string,
    actor: TaskActor,
    input: CreateChecklistItemInput,
  ) {
    const task = await getVisibleTask(workspaceId, taskId, actor);
    assertCanMutateTask(actor, task, "manage checklist");

    const last = await prisma.checklistItem.findFirst({
      where: { taskId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const position = (last?.position ?? 0) + 1000;

    const item = await prisma.checklistItem.create({
      data: {
        taskId,
        title: input.title,
        position,
        createdById: actor.userId,
      },
    });

    await recordActivity({
      workspaceId,
      actorId: actor.userId,
      action: ACTIVITY_ACTIONS.CHECKLIST_ITEM_CREATED,
      resourceType: "task",
      resourceId: taskId,
      projectId: task.projectId,
      summary: `Added checklist item on "${task.title}"`,
      metadata: { itemId: item.id, title: item.title },
    });

    return mapItem(item);
  },

  async update(
    workspaceId: string,
    taskId: string,
    itemId: string,
    actor: TaskActor,
    input: UpdateChecklistItemInput,
  ) {
    const task = await getVisibleTask(workspaceId, taskId, actor);
    assertCanMutateTask(actor, task, "manage checklist");

    const existing = await prisma.checklistItem.findFirst({
      where: { id: itemId, taskId },
    });
    if (!existing) throw new NotFoundError("Checklist item not found");

    const completing =
      input.isCompleted === true && !existing.isCompleted
        ? { completedById: actor.userId, completedAt: new Date() }
        : input.isCompleted === false
          ? { completedById: null, completedAt: null }
          : {};

    const item = await prisma.checklistItem.update({
      where: { id: itemId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.isCompleted !== undefined
          ? { isCompleted: input.isCompleted, ...completing }
          : {}),
      },
    });

    await recordActivity({
      workspaceId,
      actorId: actor.userId,
      action:
        input.isCompleted === true
          ? ACTIVITY_ACTIONS.CHECKLIST_ITEM_COMPLETED
          : ACTIVITY_ACTIONS.CHECKLIST_ITEM_UPDATED,
      resourceType: "task",
      resourceId: taskId,
      projectId: task.projectId,
      summary: `Updated checklist on "${task.title}"`,
      metadata: { itemId: item.id, isCompleted: item.isCompleted },
    });

    return mapItem(item);
  },

  async remove(
    workspaceId: string,
    taskId: string,
    itemId: string,
    actor: TaskActor,
  ) {
    const task = await getVisibleTask(workspaceId, taskId, actor);
    assertCanMutateTask(actor, task, "manage checklist");

    const existing = await prisma.checklistItem.findFirst({
      where: { id: itemId, taskId },
    });
    if (!existing) throw new NotFoundError("Checklist item not found");

    await prisma.checklistItem.delete({ where: { id: itemId } });

    await recordActivity({
      workspaceId,
      actorId: actor.userId,
      action: ACTIVITY_ACTIONS.CHECKLIST_ITEM_DELETED,
      resourceType: "task",
      resourceId: taskId,
      projectId: task.projectId,
      summary: `Removed checklist item from "${task.title}"`,
      metadata: { itemId },
    });

    return { id: itemId };
  },

  async reorder(
    workspaceId: string,
    taskId: string,
    actor: TaskActor,
    input: ReorderChecklistInput,
  ) {
    const task = await getVisibleTask(workspaceId, taskId, actor);
    assertCanMutateTask(actor, task, "manage checklist");

    const existing = await prisma.checklistItem.findMany({
      where: { taskId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((item) => item.id));
    if (
      input.orderedIds.length !== existingIds.size ||
      input.orderedIds.some((id) => !existingIds.has(id))
    ) {
      throw new ValidationError("orderedIds must include every checklist item exactly once", {
        field: "orderedIds",
      });
    }

    await prisma.$transaction(
      input.orderedIds.map((id, index) =>
        prisma.checklistItem.update({
          where: { id },
          data: { position: (index + 1) * 1000 },
        }),
      ),
    );

    return this.list(workspaceId, taskId, actor);
  },
};

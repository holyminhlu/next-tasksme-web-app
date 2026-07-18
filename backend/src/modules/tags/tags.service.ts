import { prisma } from "../../config/database.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { recordActivity, ACTIVITY_ACTIONS } from "../../services/activity.service.js";
import {
  assertCanMutateTask,
  getVisibleTask,
  type TaskActor,
} from "../tasks/task-access.js";
import type {
  CreateTagInput,
  ListTagsQuery,
  SetTaskTagsInput,
  UpdateTagInput,
} from "./tags.schemas.js";

function mapTag(tag: {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: tag.id,
    workspaceId: tag.workspaceId,
    name: tag.name,
    color: tag.color,
    createdById: tag.createdById,
    createdAt: tag.createdAt.toISOString(),
    updatedAt: tag.updatedAt.toISOString(),
  };
}

export const tagsService = {
  async list(workspaceId: string, query: ListTagsQuery = {}) {
    const tags = await prisma.tag.findMany({
      where: {
        workspaceId,
        ...(query.q
          ? { name: { contains: query.q, mode: "insensitive" as const } }
          : {}),
      },
      orderBy: { name: "asc" },
      take: 200,
    });
    return tags.map(mapTag);
  },

  async create(workspaceId: string, actor: TaskActor, input: CreateTagInput) {
    try {
      const tag = await prisma.tag.create({
        data: {
          workspaceId,
          name: input.name,
          color: input.color,
          createdById: actor.userId,
        },
      });
      await recordActivity({
        workspaceId,
        actorId: actor.userId,
        action: ACTIVITY_ACTIONS.TAG_CREATED,
        resourceType: "tag",
        resourceId: tag.id,
        summary: `Created tag "${tag.name}"`,
        metadata: { name: tag.name, color: tag.color },
      });
      return mapTag(tag);
    } catch (error) {
      if (
        typeof error === "object" &&
        error &&
        "code" in error &&
        error.code === "P2002"
      ) {
        throw new ConflictError("A tag with this name already exists");
      }
      throw error;
    }
  },

  async update(
    workspaceId: string,
    tagId: string,
    actor: TaskActor,
    input: UpdateTagInput,
  ) {
    const existing = await prisma.tag.findFirst({
      where: { id: tagId, workspaceId },
    });
    if (!existing) throw new NotFoundError("Tag not found");

    try {
      const tag = await prisma.tag.update({
        where: { id: tagId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
        },
      });
      return mapTag(tag);
    } catch (error) {
      if (
        typeof error === "object" &&
        error &&
        "code" in error &&
        error.code === "P2002"
      ) {
        throw new ConflictError("A tag with this name already exists");
      }
      throw error;
    }
  },

  async remove(workspaceId: string, tagId: string, actor: TaskActor) {
    const existing = await prisma.tag.findFirst({
      where: { id: tagId, workspaceId },
    });
    if (!existing) throw new NotFoundError("Tag not found");

    // Cascade deletes TaskTag rows only — tasks remain.
    await prisma.tag.delete({ where: { id: tagId } });

    await recordActivity({
      workspaceId,
      actorId: actor.userId,
      action: ACTIVITY_ACTIONS.TAG_DELETED,
      resourceType: "tag",
      resourceId: tagId,
      summary: `Deleted tag "${existing.name}"`,
      metadata: { name: existing.name },
    });

    return { id: tagId };
  },

  async listForTask(workspaceId: string, taskId: string, actor: TaskActor) {
    await getVisibleTask(workspaceId, taskId, actor);
    const rows = await prisma.taskTag.findMany({
      where: { taskId, tag: { workspaceId } },
      include: { tag: true },
      orderBy: { tag: { name: "asc" } },
    });
    return rows.map((row) => mapTag(row.tag));
  },

  async setForTask(
    workspaceId: string,
    taskId: string,
    actor: TaskActor,
    input: SetTaskTagsInput,
  ) {
    const task = await getVisibleTask(workspaceId, taskId, actor);
    assertCanMutateTask(actor, task, "manage tags");

    if (input.tagIds.length > 0) {
      const tags = await prisma.tag.findMany({
        where: { workspaceId, id: { in: input.tagIds } },
        select: { id: true },
      });
      if (tags.length !== input.tagIds.length) {
        throw new ValidationError("One or more tags are invalid for this workspace", {
          field: "tagIds",
        });
      }
    }

    await prisma.$transaction([
      prisma.taskTag.deleteMany({ where: { taskId } }),
      ...(input.tagIds.length
        ? [
            prisma.taskTag.createMany({
              data: input.tagIds.map((tagId) => ({ taskId, tagId })),
            }),
          ]
        : []),
    ]);

    await recordActivity({
      workspaceId,
      actorId: actor.userId,
      action: ACTIVITY_ACTIONS.TASK_TAGS_UPDATED,
      resourceType: "task",
      resourceId: taskId,
      projectId: task.projectId,
      summary: `Updated tags on "${task.title}"`,
      metadata: { tagIds: input.tagIds },
    });

    return this.listForTask(workspaceId, taskId, actor);
  },
};

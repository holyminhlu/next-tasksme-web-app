import { prisma } from "../../config/database.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { extractMentionTokens, sanitizePlainText } from "../../lib/sanitize.js";
import { buildTaskVisibilityWhere } from "../../lib/task-scope.js";
import { recordActivity, ACTIVITY_ACTIONS } from "../../services/activity.service.js";
import { broadcastCommentEvent } from "../../realtime/socket-hub.js";
import { getVisibleTask, type TaskActor } from "../tasks/task-access.js";
import type {
  CreateCommentInput,
  ListCommentsQuery,
  UpdateCommentInput,
} from "./comments.schemas.js";

function mapComment(comment: {
  id: string;
  taskId: string;
  authorId: string;
  parentCommentId: string | null;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  author?: { id: string; fullName: string; email: string } | null;
  mentions?: Array<{ userId: string }>;
}) {
  return {
    id: comment.id,
    taskId: comment.taskId,
    authorId: comment.authorId,
    authorName: comment.author?.fullName ?? null,
    authorEmail: comment.author?.email ?? null,
    parentCommentId: comment.parentCommentId,
    content: comment.deletedAt ? "" : comment.content,
    mentionUserIds: comment.mentions?.map((row) => row.userId) ?? [],
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    deletedAt: comment.deletedAt?.toISOString() ?? null,
    deleted: Boolean(comment.deletedAt),
  };
}

async function resolveMentionUserIds(
  workspaceId: string,
  taskId: string,
  content: string,
  actor: TaskActor,
) {
  const tokens = extractMentionTokens(content);
  if (tokens.length === 0) return [] as string[];

  const uuidTokens = tokens.filter((token) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      token,
    ),
  );
  const emailTokens = tokens
    .filter((token) => token.includes("@"))
    .map((token) => token.toLowerCase());

  const members = await prisma.workspaceMember.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      status: "ACTIVE",
      OR: [
        ...(uuidTokens.length ? [{ userId: { in: uuidTokens } }] : []),
        ...(emailTokens.length
          ? [{ user: { email: { in: emailTokens } } }]
          : []),
      ],
    },
    include: { user: { select: { id: true, email: true } }, role: true },
  });

  const visible: string[] = [];
  for (const member of members) {
    const canSee = await prisma.task.findFirst({
      where: {
        id: taskId,
        ...buildTaskVisibilityWhere({
          workspaceId,
          userId: member.userId,
          roleKey: member.role.key,
        }),
      },
      select: { id: true },
    });
    if (canSee) visible.push(member.userId);
  }

  // Actor may mention themselves; keep unique.
  return [...new Set(visible)].filter((userId) => userId !== actor.userId);
}

async function createMentionNotifications(input: {
  workspaceId: string;
  taskId: string;
  taskTitle: string;
  commentId: string;
  actorId: string;
  userIds: string[];
}) {
  for (const userId of input.userIds) {
    const prefs = await prisma.notificationPreference.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: input.workspaceId,
          userId,
        },
      },
    });
    if (prefs && prefs.taskMentioned === false) continue;

    await prisma.notification.upsert({
      where: {
        dedupeKey: `mention:${input.commentId}:${userId}`,
      },
      create: {
        workspaceId: input.workspaceId,
        userId,
        taskId: input.taskId,
        type: "TASK_MENTIONED",
        title: "You were mentioned in a comment",
        body: `Mentioned on "${input.taskTitle}"`,
        dedupeKey: `mention:${input.commentId}:${userId}`,
      },
      update: {},
    });
  }
}

export const commentsService = {
  async list(
    workspaceId: string,
    taskId: string,
    actor: TaskActor,
    query: ListCommentsQuery = {},
  ) {
    await getVisibleTask(workspaceId, taskId, actor);
    const comments = await prisma.comment.findMany({
      where: {
        taskId,
        ...(query.includeDeleted ? {} : { deletedAt: null }),
      },
      include: {
        author: { select: { id: true, fullName: true, email: true } },
        mentions: { select: { userId: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 500,
    });
    return comments.map(mapComment);
  },

  async create(
    workspaceId: string,
    taskId: string,
    actor: TaskActor,
    input: CreateCommentInput,
  ) {
    const task = await getVisibleTask(workspaceId, taskId, actor);

    const content = sanitizePlainText(input.content);
    if (!content) {
      throw new ValidationError("content is required", { field: "content" });
    }

    if (input.parentCommentId) {
      const parent = await prisma.comment.findFirst({
        where: {
          id: input.parentCommentId,
          taskId,
          deletedAt: null,
        },
      });
      if (!parent) {
        throw new ValidationError("parentCommentId is invalid", {
          field: "parentCommentId",
        });
      }
    }

    const mentionUserIds = await resolveMentionUserIds(
      workspaceId,
      taskId,
      content,
      actor,
    );

    const comment = await prisma.comment.create({
      data: {
        taskId,
        authorId: actor.userId,
        parentCommentId: input.parentCommentId ?? null,
        content,
        mentions: {
          create: mentionUserIds.map((userId) => ({ userId })),
        },
      },
      include: {
        author: { select: { id: true, fullName: true, email: true } },
        mentions: { select: { userId: true } },
      },
    });

    await createMentionNotifications({
      workspaceId,
      taskId,
      taskTitle: task.title,
      commentId: comment.id,
      actorId: actor.userId,
      userIds: mentionUserIds,
    });

    await recordActivity({
      workspaceId,
      actorId: actor.userId,
      action: ACTIVITY_ACTIONS.COMMENT_CREATED,
      resourceType: "task",
      resourceId: taskId,
      projectId: task.projectId,
      summary: `Commented on "${task.title}"`,
      metadata: { commentId: comment.id },
    });

    const mapped = mapComment(comment);
    // Broadcast only after DB commit.
    broadcastCommentEvent({
      workspaceId,
      taskId,
      comment: mapped,
      event: "comment:created",
    });
    return mapped;
  },

  async update(
    workspaceId: string,
    taskId: string,
    commentId: string,
    actor: TaskActor,
    input: UpdateCommentInput,
  ) {
    await getVisibleTask(workspaceId, taskId, actor);
    const existing = await prisma.comment.findFirst({
      where: { id: commentId, taskId, deletedAt: null },
    });
    if (!existing) throw new NotFoundError("Comment not found");

    const canModerate = actor.permissions?.includes("comment.moderate");
    if (existing.authorId !== actor.userId && !canModerate) {
      throw new ForbiddenError("You can only edit your own comments");
    }

    const content = sanitizePlainText(input.content);
    if (!content) {
      throw new ValidationError("content is required", { field: "content" });
    }

    const mentionUserIds = await resolveMentionUserIds(
      workspaceId,
      taskId,
      content,
      actor,
    );

    await prisma.commentMention.deleteMany({ where: { commentId } });
    const comment = await prisma.comment.update({
      where: { id: commentId },
      data: {
        content,
        mentions: {
          create: mentionUserIds.map((userId) => ({ userId })),
        },
      },
      include: {
        author: { select: { id: true, fullName: true, email: true } },
        mentions: { select: { userId: true } },
      },
    });

    const mapped = mapComment(comment);
    broadcastCommentEvent({
      workspaceId,
      taskId,
      comment: mapped,
      event: "comment:updated",
    });

    await recordActivity({
      workspaceId,
      actorId: actor.userId,
      action: ACTIVITY_ACTIONS.COMMENT_UPDATED,
      resourceType: "task",
      resourceId: taskId,
      summary: "Updated a comment",
      metadata: { commentId },
    });

    return mapped;
  },

  async remove(
    workspaceId: string,
    taskId: string,
    commentId: string,
    actor: TaskActor,
  ) {
    await getVisibleTask(workspaceId, taskId, actor);
    const existing = await prisma.comment.findFirst({
      where: { id: commentId, taskId, deletedAt: null },
    });
    if (!existing) throw new NotFoundError("Comment not found");

    const canModerate = actor.permissions?.includes("comment.moderate");
    if (existing.authorId !== actor.userId && !canModerate) {
      throw new ForbiddenError("You can only delete your own comments");
    }

    const comment = await prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date(), content: "" },
      include: {
        author: { select: { id: true, fullName: true, email: true } },
        mentions: { select: { userId: true } },
      },
    });

    const mapped = mapComment(comment);
    broadcastCommentEvent({
      workspaceId,
      taskId,
      comment: mapped,
      event: "comment:deleted",
    });

    await recordActivity({
      workspaceId,
      actorId: actor.userId,
      action: ACTIVITY_ACTIONS.COMMENT_DELETED,
      resourceType: "task",
      resourceId: taskId,
      summary: "Deleted a comment",
      metadata: { commentId },
    });

    return mapped;
  },
};

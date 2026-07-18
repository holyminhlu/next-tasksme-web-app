import { prisma } from "../../config/database.js";
import { NotFoundError } from "../../lib/errors.js";
import { buildPaginationMeta } from "../../lib/pagination.js";
import type {
  ListNotificationsQuery,
  UpdateNotificationPreferenceInput,
} from "./notifications.schemas.js";

export class NotificationsService {
  async list(workspaceId: string, userId: string, query: ListNotificationsQuery) {
    const where = {
      workspaceId,
      userId,
      ...(query.unread ? { readAt: null } : {}),
    };
    const [total, unreadCount, items] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { workspaceId, userId, readAt: null },
      }),
      prisma.notification.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        readAt: item.readAt?.toISOString() ?? null,
        createdAt: item.createdAt.toISOString(),
      })),
      unreadCount,
      pagination: buildPaginationMeta(query.page, query.pageSize, total),
    };
  }

  async markRead(workspaceId: string, notificationId: string, userId: string) {
    const result = await prisma.notification.updateMany({
      where: { id: notificationId, workspaceId, userId },
      data: { readAt: new Date() },
    });
    if (result.count !== 1) throw new NotFoundError("Notification not found");
    return prisma.notification.findUniqueOrThrow({ where: { id: notificationId } });
  }

  async markAllRead(workspaceId: string, userId: string) {
    const result = await prisma.notification.updateMany({
      where: { workspaceId, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { marked: result.count };
  }

  async getPreference(workspaceId: string, userId: string) {
    const preference = await prisma.notificationPreference.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    return {
      workspaceId,
      userId,
      taskAssigned: preference?.taskAssigned ?? true,
      taskMentioned: preference?.taskMentioned ?? true,
      taskUnblocked: preference?.taskUnblocked ?? true,
      updatedAt: preference?.updatedAt.toISOString() ?? null,
    };
  }

  async updatePreference(
    workspaceId: string,
    userId: string,
    input: UpdateNotificationPreferenceInput,
  ) {
    const preference = await prisma.notificationPreference.upsert({
      where: { workspaceId_userId: { workspaceId, userId } },
      update: {
        taskAssigned: input.taskAssigned,
        taskMentioned: input.taskMentioned,
        taskUnblocked: input.taskUnblocked,
      },
      create: {
        workspaceId,
        userId,
        taskAssigned: input.taskAssigned ?? true,
        taskMentioned: input.taskMentioned ?? true,
        taskUnblocked: input.taskUnblocked ?? true,
      },
    });
    return {
      workspaceId: preference.workspaceId,
      userId: preference.userId,
      taskAssigned: preference.taskAssigned,
      taskMentioned: preference.taskMentioned,
      taskUnblocked: preference.taskUnblocked,
      updatedAt: preference.updatedAt.toISOString(),
    };
  }
}

export const notificationsService = new NotificationsService();

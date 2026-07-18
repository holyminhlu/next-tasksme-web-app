import { get, patch } from "@/lib/api/client";
import { buildQueryString } from "@/lib/api/query";
import {
  MAPPING_ERROR,
  isRouteNotFound,
  toServiceResult,
  type ServiceResult,
} from "@/lib/api/service";
import {
  mapNotification,
  mapNotificationList,
  mapNotificationPreference,
} from "./notifications.helpers";
import type {
  NotificationListFilters,
  NotificationListResult,
  NotificationPreference,
  WorkspaceNotification,
} from "./notifications.types";

function requireMapped<T>(result: ServiceResult<T | null>): ServiceResult<T> {
  if (result.ok && result.data === null) {
    return MAPPING_ERROR;
  }

  return result as ServiceResult<T>;
}

export async function listNotifications(
  workspaceId: string,
  filters: NotificationListFilters = {},
): Promise<ServiceResult<NotificationListResult>> {
  const envelope = await get<unknown>(
    `/workspaces/${workspaceId}/notifications${buildQueryString({
      unread: filters.unread || undefined,
      page: filters.page,
      pageSize: filters.pageSize,
    })}`,
  );

  return toServiceResult(envelope, (data, meta) =>
    mapNotificationList(data, meta),
  );
}

/** Unread count from list `meta.unreadCount`, with total fallback. */
export async function getUnreadNotificationCount(
  workspaceId: string,
): Promise<ServiceResult<number>> {
  const result = await listNotifications(workspaceId, {
    page: 1,
    pageSize: 1,
  });

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    data:
      result.data.unreadCount > 0 || result.data.total === 0
        ? result.data.unreadCount
        : result.data.total,
    meta: result.meta,
  };
}

export async function markNotificationRead(
  workspaceId: string,
  notificationId: string,
): Promise<ServiceResult<WorkspaceNotification>> {
  const envelope = await patch<unknown>(
    `/workspaces/${workspaceId}/notifications/${notificationId}/read`,
  );

  return requireMapped(
    toServiceResult(envelope, (data) => mapNotification(data)),
  );
}

/**
 * Marks every unread notification read. Prefers a dedicated bulk endpoint when
 * present; otherwise fans out to per-item PATCH /read.
 */
export async function markAllNotificationsRead(
  workspaceId: string,
  notificationIds?: string[],
): Promise<ServiceResult<{ marked: number }>> {
  const bulkCandidates = [
    () =>
      patch<unknown>(`/workspaces/${workspaceId}/notifications/read-all`, {}),
    () =>
      patch<unknown>(
        `/workspaces/${workspaceId}/notifications/mark-all-read`,
        {},
      ),
  ];

  for (const attempt of bulkCandidates) {
    const envelope = await attempt();
    if (envelope.success) {
      const record =
        envelope.data && typeof envelope.data === "object"
          ? (envelope.data as Record<string, unknown>)
          : null;
      const marked =
        typeof record?.marked === "number"
          ? record.marked
          : typeof record?.count === "number"
            ? record.count
            : notificationIds?.length ?? 0;
      return { ok: true, data: { marked }, meta: envelope.meta };
    }

    if (!isRouteNotFound(envelope)) {
      // Prefer fan-out when the bulk route is missing; otherwise surface errors.
      if (envelope.error.code !== "NOT_FOUND") {
        return {
          ok: false,
          code: envelope.error.code,
          message: envelope.error.message,
        };
      }
    }
  }

  let ids = notificationIds;
  if (!ids) {
    const listed = await listNotifications(workspaceId, {
      unread: true,
      page: 1,
      pageSize: 100,
    });
    if (!listed.ok) {
      return listed;
    }
    ids = listed.data.items.map((item) => item.id);
  }

  let marked = 0;
  for (const id of ids) {
    const result = await markNotificationRead(workspaceId, id);
    if (result.ok) {
      marked += 1;
    }
  }

  return { ok: true, data: { marked } };
}

export async function getNotificationPreference(
  workspaceId: string,
): Promise<ServiceResult<NotificationPreference>> {
  const paths = [
    `/workspaces/${workspaceId}/notifications/preferences`,
    `/workspaces/${workspaceId}/notifications/preference`,
  ];

  let lastError: ServiceResult<NotificationPreference> | null = null;

  for (const path of paths) {
    const envelope = await get<unknown>(path);
    if (envelope.success) {
      return requireMapped(
        toServiceResult(envelope, (data) => mapNotificationPreference(data)),
      );
    }

    if (!isRouteNotFound(envelope)) {
      return {
        ok: false,
        code: envelope.error.code,
        message: envelope.error.message,
      };
    }

    lastError = {
      ok: false,
      code: envelope.error.code,
      message: envelope.error.message,
    };
  }

  return (
    lastError ?? {
      ok: false,
      code: "NOT_FOUND",
      message: "Notification preferences are not available yet.",
    }
  );
}

export async function updateNotificationPreference(
  workspaceId: string,
  input: NotificationPreference,
): Promise<ServiceResult<NotificationPreference>> {
  const paths = [
    `/workspaces/${workspaceId}/notifications/preferences`,
    `/workspaces/${workspaceId}/notifications/preference`,
  ];

  let lastError: ServiceResult<NotificationPreference> | null = null;

  for (const path of paths) {
    const envelope = await patch<unknown>(path, input);
    if (envelope.success) {
      return requireMapped(
        toServiceResult(envelope, (data) => mapNotificationPreference(data)),
      );
    }

    if (!isRouteNotFound(envelope)) {
      return {
        ok: false,
        code: envelope.error.code,
        message: envelope.error.message,
      };
    }

    lastError = {
      ok: false,
      code: envelope.error.code,
      message: envelope.error.message,
    };
  }

  return (
    lastError ?? {
      ok: false,
      code: "NOT_FOUND",
      message: "Notification preferences are not available yet.",
    }
  );
}

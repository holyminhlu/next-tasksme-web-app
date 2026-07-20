import {
  asBoolean,
  asNonEmptyString,
  asNumber,
  asRecord,
  pick,
} from "@/lib/api/coerce";
import type {
  NotificationListResult,
  NotificationPreference,
  WorkspaceNotification,
} from "./notifications.types";

export function notificationHref(
  notification: Pick<WorkspaceNotification, "taskId" | "type">,
): string | null {
  if (notification.taskId) {
    return `/my-tasks?taskId=${encodeURIComponent(notification.taskId)}`;
  }

  if (notification.type === "TASK_ASSIGNED") {
    return "/my-tasks";
  }

  return null;
}

export function mapNotification(raw: unknown): WorkspaceNotification | null {
  const record = asRecord(raw);

  if (!record) {
    return null;
  }

  const id = pick(record, ["id", "notificationId"], asNonEmptyString);
  const title = pick(record, ["title"], asNonEmptyString);

  if (!id || !title) {
    return null;
  }

  const taskId = pick(record, ["taskId"], asNonEmptyString);
  const type = pick(record, ["type"], asNonEmptyString) ?? "TASK_ASSIGNED";
  const mapped: WorkspaceNotification = {
    id,
    workspaceId: pick(record, ["workspaceId"], asNonEmptyString),
    taskId,
    type,
    title,
    body: pick(record, ["body", "message"], asNonEmptyString),
    readAt: pick(record, ["readAt"], asNonEmptyString),
    createdAt: pick(record, ["createdAt"], asNonEmptyString),
    href: null,
  };

  mapped.href = notificationHref(mapped);
  return mapped;
}

export function mapNotificationList(
  data: unknown,
  meta?: unknown,
): NotificationListResult {
  const record = asRecord(data);
  const metaRecord = asRecord(meta);
  const pagination = asRecord(metaRecord?.pagination) ?? asRecord(record?.pagination);

  const rawItems = Array.isArray(data)
    ? data
    : (record?.items ?? record?.notifications ?? record?.data);

  const items = (Array.isArray(rawItems) ? rawItems : [])
    .map(mapNotification)
    .filter((item): item is WorkspaceNotification => item !== null);

  const total =
    pick(pagination, ["total", "totalItems"], asNumber) ??
    pick(record, ["total"], asNumber) ??
    items.length;

  const unreadFromItems = items.filter((item) => !item.readAt).length;
  const unreadCount =
    pick(metaRecord, ["unreadCount", "unread"], asNumber) ??
    pick(record, ["unreadCount", "unread"], asNumber) ??
    pick(pagination, ["unreadCount"], asNumber) ??
    unreadFromItems;

  return { items, total, unreadCount };
}

export function mapNotificationPreference(
  raw: unknown,
): NotificationPreference | null {
  const record = asRecord(raw);

  if (!record) {
    return null;
  }

  const nested =
    asRecord(record.preferences) ??
    asRecord(record.preference) ??
    asRecord(record.notificationPrefs) ??
    record;

  const taskAssigned = asBoolean(nested.taskAssigned);

  if (taskAssigned === null) {
    return null;
  }

  return {
    taskAssigned,
    taskMentioned: asBoolean(nested.taskMentioned) ?? true,
    taskUnblocked: asBoolean(nested.taskUnblocked) ?? true,
    recurrenceCreated: asBoolean(nested.recurrenceCreated) ?? true,
    recurrenceSkipped: asBoolean(nested.recurrenceSkipped) ?? true,
    slaWarning: asBoolean(nested.slaWarning) ?? true,
    slaBreached: asBoolean(nested.slaBreached) ?? true,
    riskEscalated: asBoolean(nested.riskEscalated) ?? true,
  };
}

export function unreadNotificationIds(
  notifications: WorkspaceNotification[],
): string[] {
  return notifications.filter((item) => !item.readAt).map((item) => item.id);
}

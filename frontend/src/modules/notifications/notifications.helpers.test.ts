import { describe, expect, it } from "vitest";
import {
  mapNotification,
  mapNotificationList,
  mapNotificationPreference,
  notificationHref,
  unreadNotificationIds,
} from "./notifications.helpers";

describe("mapNotification", () => {
  it("maps assignment notifications with task deep-link", () => {
    const mapped = mapNotification({
      id: "n1",
      workspaceId: "ws",
      taskId: "t1",
      type: "TASK_ASSIGNED",
      title: "You were assigned",
      body: "Prepare report",
      readAt: null,
      createdAt: "2026-07-18T01:00:00.000Z",
    });

    expect(mapped).toMatchObject({
      id: "n1",
      type: "TASK_ASSIGNED",
      title: "You were assigned",
      body: "Prepare report",
      readAt: null,
      href: "/my-tasks?taskId=t1",
    });
  });

  it("returns null for malformed payloads", () => {
    expect(mapNotification({ title: "missing id" })).toBeNull();
  });
});

describe("mapNotificationList", () => {
  it("maps items and unread totals", () => {
    const result = mapNotificationList(
      {
        items: [
          { id: "n1", title: "A", readAt: null },
          { id: "n2", title: "B", readAt: "2026-07-18T02:00:00.000Z" },
        ],
      },
      { pagination: { total: 2 }, unreadCount: 1 },
    );

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.unreadCount).toBe(1);
    expect(unreadNotificationIds(result.items)).toEqual(["n1"]);
  });
});

describe("mapNotificationPreference", () => {
  it("reads taskAssigned from nested or flat payloads", () => {
    expect(mapNotificationPreference({ taskAssigned: false })).toEqual({
      taskAssigned: false,
    });
    expect(
      mapNotificationPreference({ preferences: { taskAssigned: true } }),
    ).toEqual({ taskAssigned: true });
  });
});

describe("notificationHref", () => {
  it("falls back to my-tasks for assignment without task id", () => {
    expect(notificationHref({ taskId: null, type: "TASK_ASSIGNED" })).toBe(
      "/my-tasks",
    );
  });
});

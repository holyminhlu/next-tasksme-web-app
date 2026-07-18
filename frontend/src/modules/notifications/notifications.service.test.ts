import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({
  get: vi.fn(),
  patch: vi.fn(),
}));

import { get, patch } from "@/lib/api/client";
import * as notificationsService from "./notifications.service";

const WS = "ws-1";

const ok = (data: unknown, meta?: Record<string, unknown>) => ({
  success: true as const,
  data,
  meta,
});

const fail = (code: string, message: string) => ({
  success: false as const,
  error: { code, message },
});

beforeEach(() => {
  vi.mocked(get).mockReset();
  vi.mocked(patch).mockReset();
});

describe("listNotifications", () => {
  it("calls the workspace notifications route", async () => {
    vi.mocked(get).mockResolvedValue(
      ok([{ id: "n1", title: "Assigned", type: "TASK_ASSIGNED" }]),
    );

    const result = await notificationsService.listNotifications(WS, {
      unread: true,
      page: 1,
      pageSize: 20,
    });

    expect(result.ok).toBe(true);
    expect(vi.mocked(get).mock.calls[0][0]).toContain(
      `/workspaces/${WS}/notifications?`,
    );
    expect(vi.mocked(get).mock.calls[0][0]).toContain("unread=true");
  });
});

describe("markNotificationRead", () => {
  it("patches the read route", async () => {
    vi.mocked(patch).mockResolvedValue(
      ok({
        id: "n1",
        title: "Assigned",
        readAt: "2026-07-18T03:00:00.000Z",
      }),
    );

    const result = await notificationsService.markNotificationRead(WS, "n1");
    expect(result.ok).toBe(true);
    expect(patch).toHaveBeenCalledWith(
      `/workspaces/${WS}/notifications/n1/read`,
    );
  });
});

describe("markAllNotificationsRead", () => {
  it("fans out when bulk route is missing", async () => {
    vi.mocked(patch)
      .mockResolvedValueOnce(
        fail("NOT_FOUND", "Route PATCH /notifications/read-all not found"),
      )
      .mockResolvedValueOnce(
        fail("NOT_FOUND", "Route PATCH /notifications/mark-all-read not found"),
      )
      .mockResolvedValueOnce(
        ok({ id: "n1", title: "A", readAt: "2026-07-18T03:00:00.000Z" }),
      )
      .mockResolvedValueOnce(
        ok({ id: "n2", title: "B", readAt: "2026-07-18T03:00:00.000Z" }),
      );

    const result = await notificationsService.markAllNotificationsRead(WS, [
      "n1",
      "n2",
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.marked).toBe(2);
    }
  });
});

describe("notification preferences", () => {
  it("loads and updates taskAssigned via preferences path", async () => {
    vi.mocked(get).mockResolvedValue(ok({ taskAssigned: true }));
    vi.mocked(patch).mockResolvedValue(ok({ taskAssigned: false }));

    const loaded = await notificationsService.getNotificationPreference(WS);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.data.taskAssigned).toBe(true);
    }

    const updated = await notificationsService.updateNotificationPreference(
      WS,
      { taskAssigned: false },
    );
    expect(updated.ok).toBe(true);
    expect(patch).toHaveBeenCalledWith(
      `/workspaces/${WS}/notifications/preferences`,
      { taskAssigned: false },
    );
  });
});

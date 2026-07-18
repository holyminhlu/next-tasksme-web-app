import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

import { del, get, patch, post, put } from "@/lib/api/client";
import * as tasksService from "./tasks.service";

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

const routeMissing = {
  success: false as const,
  error: { code: "NOT_FOUND", message: "Route GET /tasks not found" },
};

const task = (overrides: Record<string, unknown> = {}) => ({
  id: "t1",
  title: "Prepare report",
  status: "TODO",
  priority: "MEDIUM",
  version: 1,
  taskNumber: 7,
  ...overrides,
});

beforeEach(() => {
  vi.mocked(get).mockReset();
  vi.mocked(post).mockReset();
  vi.mocked(patch).mockReset();
  vi.mocked(put).mockReset();
  vi.mocked(del).mockReset();
});

describe("listTasks", () => {
  it("calls the workspace-scoped route with Phase 5 filters", async () => {
    vi.mocked(get).mockResolvedValue(ok({ items: [task()], total: 1 }));

    await tasksService.listTasks(WS, {
      status: ["TODO", "DONE"],
      priority: ["HIGH"],
      projectId: "p1",
      assigneeId: "u1",
      createdById: "u2",
      search: "report",
      due: "today",
      overdue: true,
      unassigned: false,
      includeArchived: true,
      deadlineFrom: "2026-07-01T00:00:00.000Z",
      deadlineTo: "2026-07-31T00:00:00.000Z",
      timezone: "Asia/Bangkok",
      page: 2,
      pageSize: 20,
      sortBy: "dueDate",
      sortOrder: "asc",
    });

    expect(get).toHaveBeenCalledTimes(1);
    const url = vi.mocked(get).mock.calls[0][0];
    expect(url).toMatch(new RegExp(`^/workspaces/${WS}/tasks\\?`));
    expect(url).toContain("status=TODO");
    expect(url).toContain("status=DONE");
    expect(url).toContain("priority=HIGH");
    expect(url).toContain("projectId=p1");
    expect(url).toContain("assigneeId=u1");
    expect(url).toContain("createdById=u2");
    expect(url).toContain("search=report");
    expect(url).toContain("due=today");
    expect(url).toContain("overdue=true");
    expect(url).toContain("includeArchived=true");
    expect(url).toContain("sortBy=dueDate");
    expect(url).toContain("sortOrder=asc");
    expect(url).toContain("page=2");
    expect(url).toContain("pageSize=20");
  });

  it("omits empty filters entirely", async () => {
    vi.mocked(get).mockResolvedValue(ok({ items: [], total: 0 }));

    await tasksService.listTasks(WS, { status: null, search: null });

    expect(vi.mocked(get).mock.calls[0][0]).toBe(`/workspaces/${WS}/tasks`);
  });

  it("maps items with the total from pagination meta", async () => {
    vi.mocked(get).mockResolvedValue(
      ok({ items: [task()] }, { pagination: { total: 41 } }),
    );

    const result = await tasksService.listTasks(WS);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toHaveLength(1);
      expect(result.data.total).toBe(41);
      expect(result.data.items[0]?.taskNumber).toBe(7);
      expect(result.data.items[0]?.version).toBe(1);
    }
  });

  it("does not fall back to unscoped routes on errors", async () => {
    vi.mocked(get).mockResolvedValue(routeMissing);

    const result = await tasksService.listTasks(WS);

    expect(get).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Route GET /tasks not found",
    });
  });
});

describe("getTask", () => {
  it("fetches the workspace-scoped task detail route", async () => {
    vi.mocked(get).mockResolvedValue(
      ok(task({ completedAt: "2026-07-16T10:00:00.000Z" })),
    );

    const result = await tasksService.getTask(WS, "t1");

    expect(get).toHaveBeenCalledWith(`/workspaces/${WS}/tasks/t1`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.completedAt).toBe("2026-07-16T10:00:00.000Z");
    }
  });

  it("returns UNEXPECTED_RESPONSE for unusable payloads", async () => {
    vi.mocked(get).mockResolvedValue(ok({ nothing: true }));

    const result = await tasksService.getTask(WS, "t1");

    expect(result).toMatchObject({ ok: false, code: "UNEXPECTED_RESPONSE" });
  });
});

describe("createTask / updateTask / deleteTask", () => {
  it("creates via POST on the scoped collection", async () => {
    vi.mocked(post).mockResolvedValue(ok(task()));

    const input = { title: "New", priority: "HIGH" as const };
    const result = await tasksService.createTask(WS, input);

    expect(post).toHaveBeenCalledWith(`/workspaces/${WS}/tasks`, input);
    expect(result.ok).toBe(true);
  });

  it("updates via PATCH with version", async () => {
    vi.mocked(patch).mockResolvedValue(ok(task({ title: "Renamed", version: 2 })));

    const result = await tasksService.updateTask(WS, "t1", {
      version: 1,
      title: "Renamed",
    });

    expect(patch).toHaveBeenCalledWith(`/workspaces/${WS}/tasks/t1`, {
      version: 1,
      title: "Renamed",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe("Renamed");
      expect(result.data.version).toBe(2);
    }
  });

  it("surfaces CONFLICT on stale version updates", async () => {
    vi.mocked(patch).mockResolvedValue(
      fail("CONFLICT", "Task version is stale"),
    );

    const result = await tasksService.updateTask(WS, "t1", {
      version: 1,
      title: "Nope",
    });

    expect(result).toEqual({
      ok: false,
      code: "CONFLICT",
      message: "Task version is stale",
    });
  });

  it("deletes via DELETE with version query", async () => {
    vi.mocked(del).mockResolvedValue(
      ok({ id: "t1", deleted: true, deletedAt: "2026-07-17T09:00:00.000Z" }),
    );

    const result = await tasksService.deleteTask(WS, "t1", 4);

    expect(del).toHaveBeenCalledWith(`/workspaces/${WS}/tasks/t1?version=4`);
    expect(result.ok).toBe(true);
  });

  it("tolerates empty delete bodies", async () => {
    vi.mocked(del).mockResolvedValue(ok(null));

    const result = await tasksService.deleteTask(WS, "t9");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        id: "t9",
        deleted: true,
        deletedAt: null,
        version: null,
      });
    }
  });
});

describe("lifecycle / status / assignee / activity / bulk", () => {
  it("patches status and assignee endpoints with version", async () => {
    vi.mocked(patch).mockResolvedValue(ok(task({ status: "DONE", version: 2 })));

    await tasksService.updateTaskStatus(WS, "t1", {
      status: "DONE",
      version: 1,
    });
    expect(patch).toHaveBeenCalledWith(`/workspaces/${WS}/tasks/t1/status`, {
      status: "DONE",
      version: 1,
    });

    vi.mocked(patch).mockResolvedValue(
      ok(task({ assigneeId: "u9", version: 3 })),
    );
    await tasksService.updateTaskAssignee(WS, "t1", {
      assigneeId: "u9",
      version: 2,
    });
    expect(patch).toHaveBeenCalledWith(`/workspaces/${WS}/tasks/t1/assignee`, {
      assigneeId: "u9",
      version: 2,
    });
  });

  it("posts archive / unarchive / restore", async () => {
    vi.mocked(post).mockResolvedValue(ok(task({ archivedAt: "2026-07-17" })));

    await tasksService.archiveTask(WS, "t1", { version: 1 });
    expect(post).toHaveBeenCalledWith(`/workspaces/${WS}/tasks/t1/archive`, {
      version: 1,
    });

    await tasksService.unarchiveTask(WS, "t1", { version: 2 });
    expect(post).toHaveBeenCalledWith(`/workspaces/${WS}/tasks/t1/unarchive`, {
      version: 2,
    });

    await tasksService.restoreTask(WS, "t1", { version: 3 });
    expect(post).toHaveBeenCalledWith(`/workspaces/${WS}/tasks/t1/restore`, {
      version: 3,
    });
  });

  it("loads activity history", async () => {
    vi.mocked(get).mockResolvedValue(
      ok({
        items: [
          {
            id: "a1",
            summary: "Updated",
            createdAt: "2026-07-17T10:00:00.000Z",
          },
        ],
      }),
    );

    const result = await tasksService.getTaskActivity(WS, "t1", {
      page: 1,
      pageSize: 20,
    });

    expect(get).toHaveBeenCalledWith(
      `/workspaces/${WS}/tasks/t1/activity?page=1&pageSize=20`,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items[0]?.summary).toBe("Updated");
    }
  });

  it("posts bulk-update and bulk-delete payloads", async () => {
    vi.mocked(post).mockResolvedValue(
      ok({
        results: [
          { taskId: "t1", success: true, task: task({ version: 2 }) },
          {
            taskId: "t2",
            success: false,
            error: { code: "CONFLICT", message: "stale" },
          },
        ],
      }),
    );

    const update = await tasksService.bulkUpdateTasks(WS, {
      items: [
        {
          taskId: "t1",
          version: 1,
          changes: { status: "DONE" },
        },
      ],
    });

    expect(post).toHaveBeenCalledWith(
      `/workspaces/${WS}/tasks/bulk-update`,
      expect.objectContaining({
        items: [
          expect.objectContaining({
            taskId: "t1",
            version: 1,
            changes: { status: "DONE" },
          }),
        ],
      }),
    );
    expect(update.ok).toBe(true);
    if (update.ok) {
      expect(update.data.results[0]?.success).toBe(true);
      expect(update.data.results[1]?.error?.code).toBe("CONFLICT");
    }

    vi.mocked(post).mockResolvedValue(
      ok({ results: [{ taskId: "t1", success: true, task: task() }] }),
    );
    await tasksService.bulkDeleteTasks(WS, {
      items: [{ taskId: "t1", version: 2 }],
    });
    expect(post).toHaveBeenCalledWith(`/workspaces/${WS}/tasks/bulk-delete`, {
      items: [{ taskId: "t1", version: 2 }],
    });
  });
});

describe("parseTask / projects", () => {
  it("parses via the scoped parse route", async () => {
    vi.mocked(post).mockResolvedValue(ok({ draft: { title: "Call Ann" } }));

    const input = {
      text: "Call Ann tomorrow",
      locale: "en-US",
      timezone: "UTC",
      referenceDate: "2026-07-17",
    };
    const result = await tasksService.parseTask(WS, input);

    expect(post).toHaveBeenCalledWith(`/workspaces/${WS}/tasks/parse`, input);
    expect(result.ok).toBe(true);
  });

  it("lists and creates projects on scoped routes", async () => {
    vi.mocked(get).mockResolvedValue(
      ok([{ id: "p1", name: "Ops", visibility: "WORKSPACE" }]),
    );
    vi.mocked(post).mockResolvedValue(ok({ id: "p2", name: "Web" }));

    const listed = await tasksService.listProjects(WS);
    expect(get).toHaveBeenCalledWith(`/workspaces/${WS}/projects`);
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.data[0]?.visibility).toBe("WORKSPACE");
      expect(listed.data[0]?.memberIds).toEqual([]);
    }

    await tasksService.createProject(WS, {
      name: "Web",
      visibility: "PRIVATE",
      memberIds: ["u2"],
    });
    expect(post).toHaveBeenCalledWith(`/workspaces/${WS}/projects`, {
      name: "Web",
      visibility: "PRIVATE",
      memberIds: ["u2"],
    });
  });

  it("lists project members and updates membership with fallback", async () => {
    vi.mocked(get).mockResolvedValue(
      ok([
        {
          userId: "u1",
          user: { fullName: "Ann" },
          role: { key: "member" },
          status: "ACTIVE",
        },
      ]),
    );
    vi.mocked(patch).mockResolvedValueOnce(
      ok({
        id: "p1",
        name: "Private",
        visibility: "PRIVATE",
        memberIds: ["u1"],
      }),
    );
    vi.mocked(put).mockResolvedValueOnce(
      ok({
        id: "p1",
        name: "Private",
        visibility: "PRIVATE",
        memberIds: ["u1", "u2"],
      }),
    );

    const members = await tasksService.listProjectMembers(WS, "p1");
    expect(get).toHaveBeenCalledWith(
      `/workspaces/${WS}/projects/p1/members`,
    );
    expect(members.ok).toBe(true);

    const updated = await tasksService.updateProject(WS, "p1", {
      visibility: "PRIVATE",
      memberIds: ["u1", "u2"],
    });
    expect(updated.ok).toBe(true);
    expect(patch).toHaveBeenCalledWith(
      `/workspaces/${WS}/projects/p1/visibility`,
      { visibility: "PRIVATE" },
    );
    expect(put).toHaveBeenCalledWith(
      `/workspaces/${WS}/projects/p1/members`,
      { memberIds: ["u1", "u2"] },
    );
  });

  it("lists eligible assignees with optional search", async () => {
    vi.mocked(get).mockResolvedValueOnce(
      ok([
        {
          id: "u1",
          fullName: "Ann",
          email: "ann@example.com",
          role: "member",
          status: "ACTIVE",
        },
      ]),
    );

    const result = await tasksService.listEligibleAssignees(WS, "p1", "ann");
    expect(get).toHaveBeenCalledWith(
      `/workspaces/${WS}/projects/p1/eligible-assignees?search=ann`,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]?.id).toBe("u1");
      expect(result.data[0]?.name).toContain("Ann");
    }
  });
});

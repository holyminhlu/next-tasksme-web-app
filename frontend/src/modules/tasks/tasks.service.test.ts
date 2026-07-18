import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));

import { del, get, patch, post } from "@/lib/api/client";
import * as tasksService from "./tasks.service";

const WS = "ws-1";

const ok = (data: unknown, meta?: Record<string, unknown>) => ({
  success: true as const,
  data,
  meta,
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
  ...overrides,
});

beforeEach(() => {
  vi.mocked(get).mockReset();
  vi.mocked(post).mockReset();
  vi.mocked(patch).mockReset();
  vi.mocked(del).mockReset();
});

describe("listTasks", () => {
  it("calls the workspace-scoped route with all supported filters", async () => {
    vi.mocked(get).mockResolvedValue(ok({ items: [task()], total: 1 }));

    await tasksService.listTasks(WS, {
      status: "TODO",
      projectId: "p1",
      assigneeId: "u1",
      search: "report",
      due: "today",
      timezone: "Asia/Bangkok",
      page: 2,
      pageSize: 20,
    });

    expect(get).toHaveBeenCalledTimes(1);
    const url = vi.mocked(get).mock.calls[0][0];
    expect(url).toMatch(new RegExp(`^/workspaces/${WS}/tasks\\?`));
    expect(url).toContain("status=TODO");
    expect(url).toContain("projectId=p1");
    expect(url).toContain("assigneeId=u1");
    expect(url).toContain("search=report");
    expect(url).toContain("due=today");
    expect(url).toContain("timezone=Asia%2FBangkok");
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

  it("updates via PATCH on the scoped task route", async () => {
    vi.mocked(patch).mockResolvedValue(ok(task({ title: "Renamed" })));

    const result = await tasksService.updateTask(WS, "t1", {
      title: "Renamed",
    });

    expect(patch).toHaveBeenCalledWith(`/workspaces/${WS}/tasks/t1`, {
      title: "Renamed",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe("Renamed");
    }
  });

  it("deletes via DELETE and maps the receipt", async () => {
    vi.mocked(del).mockResolvedValue(
      ok({ id: "t1", deleted: true, deletedAt: "2026-07-17T09:00:00.000Z" }),
    );

    const result = await tasksService.deleteTask(WS, "t1");

    expect(del).toHaveBeenCalledWith(`/workspaces/${WS}/tasks/t1`);
    expect(result).toEqual({
      ok: true,
      data: {
        id: "t1",
        deleted: true,
        deletedAt: "2026-07-17T09:00:00.000Z",
      },
      meta: undefined,
    });
  });

  it("tolerates empty delete bodies", async () => {
    vi.mocked(del).mockResolvedValue(ok(null));

    const result = await tasksService.deleteTask(WS, "t9");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ id: "t9", deleted: true, deletedAt: null });
    }
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
    vi.mocked(get).mockResolvedValue(ok([{ id: "p1", name: "Ops" }]));
    vi.mocked(post).mockResolvedValue(ok({ id: "p2", name: "Web" }));

    await tasksService.listProjects(WS);
    expect(get).toHaveBeenCalledWith(`/workspaces/${WS}/projects`);

    await tasksService.createProject(WS, { name: "Web" });
    expect(post).toHaveBeenCalledWith(`/workspaces/${WS}/projects`, {
      name: "Web",
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  dateInputToIso,
  daysUntilDue,
  describeDueDate,
  formatAbsoluteDate,
  hasWorkspaceTaskScope,
  isTaskOverdue,
  mapDeleteTaskResult,
  mapParseResult,
  mapProjectList,
  mapTask,
  mapTaskList,
  normalizeTaskPriority,
  normalizeTaskStatus,
  toDateInputValue,
  toLocalDateString,
} from "./tasks.helpers";

const NOW = new Date("2026-07-17T12:00:00");

describe("normalizeTaskStatus / normalizeTaskPriority", () => {
  it("accepts canonical and loosely formatted values", () => {
    expect(normalizeTaskStatus("TODO")).toBe("TODO");
    expect(normalizeTaskStatus("in progress")).toBe("IN_PROGRESS");
    expect(normalizeTaskStatus("in-progress")).toBe("IN_PROGRESS");
    expect(normalizeTaskStatus("done")).toBe("DONE");
    expect(normalizeTaskStatus("nonsense")).toBeNull();
    expect(normalizeTaskStatus(42)).toBeNull();

    expect(normalizeTaskPriority("urgent")).toBe("URGENT");
    expect(normalizeTaskPriority("MEDIUM")).toBe("MEDIUM");
    expect(normalizeTaskPriority("")).toBeNull();
  });
});

describe("mapTask", () => {
  it("maps a flat backend task", () => {
    const task = mapTask({
      id: "t1",
      title: "Prepare report",
      status: "IN_PROGRESS",
      priority: "HIGH",
      dueDate: "2026-07-20T00:00:00.000Z",
      projectId: "p1",
      projectName: "Ops",
      assigneeId: "u1",
      assigneeName: "Ann",
    });

    expect(task).toMatchObject({
      id: "t1",
      title: "Prepare report",
      status: "IN_PROGRESS",
      priority: "HIGH",
      projectId: "p1",
      projectName: "Ops",
      assigneeId: "u1",
      assigneeName: "Ann",
    });
  });

  it("maps nested project/assignee objects", () => {
    const task = mapTask({
      id: "t2",
      title: "Nested",
      project: { id: "p9", name: "Website" },
      assignee: { id: "u9", fullName: "Bob Lee" },
    });

    expect(task).toMatchObject({
      projectId: "p9",
      projectName: "Website",
      assigneeId: "u9",
      assigneeName: "Bob Lee",
    });
    // Defaults applied when fields are missing.
    expect(task?.status).toBe("TODO");
    expect(task?.priority).toBe("MEDIUM");
    expect(task?.isBlocked).toBe(false);
  });

  it("maps completedAt when the backend returns it", () => {
    expect(
      mapTask(
        { id: "t3", title: "Done", completedAt: "2026-07-16T10:00:00.000Z" },
      )?.completedAt,
    ).toBe("2026-07-16T10:00:00.000Z");
    expect(
      mapTask(
        { id: "t3", title: "Done", completed_at: "2026-07-16T10:00:00.000Z" },
      )?.completedAt,
    ).toBe("2026-07-16T10:00:00.000Z");
    expect(mapTask({ id: "t4", title: "Open" })?.completedAt).toBeNull();
  });

  it("rejects payloads without id or title", () => {
    expect(mapTask({ title: "no id" })).toBeNull();
    expect(mapTask({ id: "x" })).toBeNull();
    expect(mapTask("not an object")).toBeNull();
  });
});

describe("mapDeleteTaskResult", () => {
  it("maps the delete receipt", () => {
    expect(
      mapDeleteTaskResult(
        { id: "t1", deleted: true, deletedAt: "2026-07-17T09:00:00.000Z" },
        "t1",
      ),
    ).toEqual({
      id: "t1",
      deleted: true,
      deletedAt: "2026-07-17T09:00:00.000Z",
    });
  });

  it("assumes success for empty bodies, keeping the requested id", () => {
    expect(mapDeleteTaskResult(null, "t9")).toEqual({
      id: "t9",
      deleted: true,
      deletedAt: null,
    });
  });
});

describe("hasWorkspaceTaskScope", () => {
  it("grants workspace scope to owner/admin/manager only", () => {
    expect(hasWorkspaceTaskScope("owner")).toBe(true);
    expect(hasWorkspaceTaskScope("admin")).toBe(true);
    expect(hasWorkspaceTaskScope("manager")).toBe(true);
    expect(hasWorkspaceTaskScope("member")).toBe(false);
    expect(hasWorkspaceTaskScope("custom-role")).toBe(false);
    expect(hasWorkspaceTaskScope(null)).toBe(false);
    expect(hasWorkspaceTaskScope(undefined)).toBe(false);
  });
});

describe("mapTaskList", () => {
  const items = [
    { id: "a", title: "A" },
    { id: "b", title: "B" },
    { bogus: true },
  ];

  it("handles {items,total} payloads", () => {
    const result = mapTaskList({ items, total: 12 });
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(12);
  });

  it("handles bare arrays and pagination meta", () => {
    const result = mapTaskList(items, {
      pagination: { page: 1, pageSize: 20, total: 40, totalPages: 2 },
    });
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(40);
  });

  it("falls back to item count when no total is present", () => {
    expect(mapTaskList(items).total).toBe(2);
    expect(mapTaskList(null).items).toEqual([]);
  });
});

describe("mapProjectList", () => {
  it("maps arrays and skips malformed entries", () => {
    const projects = mapProjectList([
      { id: "p1", name: "Ops", _count: { tasks: 5 } },
      { name: "missing id" },
    ]);

    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({
      id: "p1",
      name: "Ops",
      status: "ACTIVE",
      totalTasks: 5,
    });
  });

  it("unwraps {items} payloads", () => {
    expect(
      mapProjectList({ items: [{ id: "p2", name: "Web" }] }),
    ).toHaveLength(1);
  });
});

describe("mapParseResult", () => {
  it("maps the full parse contract", () => {
    const result = mapParseResult({
      draft: {
        title: "Call supplier",
        priority: "HIGH",
        status: "TODO",
        dueDate: "2026-07-18",
        projectName: "Procurement",
        assigneeName: "Ann",
      },
      missingFields: ["assigneeId"],
      ambiguities: ["Multiple projects match 'proc'"],
      projectCandidates: [{ id: "p1", name: "Procurement" }],
      assigneeCandidates: [{ id: "u1", fullName: "Ann Chu", email: "a@b.co" }],
    });

    expect(result?.draft).toMatchObject({
      title: "Call supplier",
      priority: "HIGH",
      dueDate: "2026-07-18",
    });
    expect(result?.missingFields).toEqual(["assigneeId"]);
    expect(result?.ambiguities).toHaveLength(1);
    expect(result?.projectCandidates).toEqual([
      { id: "p1", name: "Procurement" },
    ]);
    expect(result?.assigneeCandidates).toEqual([
      { id: "u1", name: "Ann Chu (a@b.co)" },
    ]);
  });

  it("returns null when there is no usable draft title", () => {
    expect(mapParseResult({ draft: {} })).toBeNull();
    expect(mapParseResult(null)).toBeNull();
  });
});

describe("due date helpers", () => {
  it("computes day deltas", () => {
    expect(daysUntilDue("2026-07-17T23:00:00", NOW)).toBe(0);
    expect(daysUntilDue("2026-07-19T01:00:00", NOW)).toBe(2);
    expect(daysUntilDue("2026-07-15T01:00:00", NOW)).toBe(-2);
    expect(daysUntilDue(null, NOW)).toBeNull();
    expect(daysUntilDue("garbage", NOW)).toBeNull();
  });

  it("flags overdue only for open tasks", () => {
    const overdue = { status: "TODO" as const, dueDate: "2026-07-10" };
    expect(isTaskOverdue(overdue, NOW)).toBe(true);
    expect(isTaskOverdue({ ...overdue, status: "DONE" }, NOW)).toBe(false);
    expect(
      isTaskOverdue({ status: "TODO", dueDate: null }, NOW),
    ).toBe(false);
  });

  it("describes due dates for badges", () => {
    expect(
      describeDueDate({ status: "TODO", dueDate: "2026-07-17T15:00:00" }, NOW),
    ).toEqual({ label: "Due today", tone: "warning" });
    expect(
      describeDueDate({ status: "TODO", dueDate: "2026-07-18" }, NOW)?.label,
    ).toBe("Due tomorrow");
    expect(
      describeDueDate({ status: "TODO", dueDate: "2026-07-14" }, NOW),
    ).toEqual({ label: "Overdue by 3 days", tone: "danger" });
    expect(describeDueDate({ status: "TODO", dueDate: null }, NOW)).toBeNull();
  });
});

describe("date formatting", () => {
  it("formats absolute localized dates", () => {
    const formatted = formatAbsoluteDate("2026-07-20T00:00:00", "en-US");
    expect(formatted).toContain("Jul");
    expect(formatted).toContain("2026");
    expect(formatAbsoluteDate(null)).toBeNull();
    expect(formatAbsoluteDate("not a date")).toBeNull();
  });

  it("produces YYYY-MM-DD strings for inputs", () => {
    expect(toLocalDateString(new Date(2026, 6, 5))).toBe("2026-07-05");
    expect(toDateInputValue("2026-07-20T10:00:00")).toBe("2026-07-20");
    expect(toDateInputValue(null)).toBe("");
  });

  it("round-trips date-input values to ISO and nulls empties", () => {
    const iso = dateInputToIso("2026-07-20");
    expect(iso).not.toBeNull();
    expect(toDateInputValue(iso)).toBe("2026-07-20");
    expect(dateInputToIso("")).toBeNull();
    expect(dateInputToIso("garbage")).toBeNull();
  });
});

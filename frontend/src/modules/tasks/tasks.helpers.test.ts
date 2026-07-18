import { describe, expect, it } from "vitest";
import {
  canAssignToOtherMembers,
  canManagePrivateProjectMembers,
  canMutateTask,
  dateInputToIso,
  daysUntilDue,
  describeDueDate,
  filterEligibleAssignees,
  formatAbsoluteDate,
  formatTaskNumber,
  hasWorkspaceTaskScope,
  initialsFromName,
  isConflictError,
  isTaskOverdue,
  mapBulkMutationResult,
  mapCalendarTasksResult,
  mapDeleteTaskResult,
  mapParseResult,
  mapProjectList,
  mapProjectMemberList,
  mapSavedView,
  mapTask,
  mapTaskActivityList,
  mapTaskList,
  mapTimelineTasksResult,
  normalizeTaskPriority,
  normalizeTaskStatus,
  pageStateToSavedViewInput,
  parseTaskFilterState,
  parseTaskViewUrlState,
  pastDueWarning,
  removeFilterChip,
  resolveBoardMoveNeighbors,
  resolveTaskListViewPreset,
  savedViewToPageState,
  serializeTaskFilterState,
  serializeTaskViewUrlState,
  taskFilterStateToListFilters,
  taskListViewPresetToFilterPatch,
  taskOverlapsDay,
  toDateInputValue,
  toLocalDateString,
  validateTaskDates,
} from "./tasks.helpers";

const NOW = new Date("2026-07-17T12:00:00");

describe("normalizeTaskStatus / normalizeTaskPriority", () => {
  it("accepts canonical and loosely formatted values", () => {
    expect(normalizeTaskStatus("TODO")).toBe("TODO");
    expect(normalizeTaskStatus("in progress")).toBe("IN_PROGRESS");
    expect(normalizeTaskStatus("in-review")).toBe("IN_REVIEW");
    expect(normalizeTaskStatus("blocked")).toBe("BLOCKED");
    expect(normalizeTaskStatus("done")).toBe("DONE");
    expect(normalizeTaskStatus("nonsense")).toBeNull();
    expect(normalizeTaskStatus(42)).toBeNull();

    expect(normalizeTaskPriority("urgent")).toBe("URGENT");
    expect(normalizeTaskPriority("MEDIUM")).toBe("MEDIUM");
    expect(normalizeTaskPriority("")).toBeNull();
  });
});

describe("mapTask", () => {
  it("maps a flat backend task with Phase 5 fields", () => {
    const task = mapTask({
      id: "t1",
      workspaceId: "ws1",
      taskNumber: 42,
      title: "Prepare report",
      status: "IN_REVIEW",
      priority: "HIGH",
      startAt: "2026-07-18T00:00:00.000Z",
      dueDate: "2026-07-20T00:00:00.000Z",
      projectId: "p1",
      projectName: "Ops",
      assigneeId: "u1",
      assigneeName: "Ann",
      createdById: "u2",
      createdByName: "Bob",
      version: 3,
      blockedReason: "Waiting on legal",
      isBlocked: true,
      source: "MANUAL",
      rank: "0000000000001000",
    });

    expect(task).toMatchObject({
      id: "t1",
      workspaceId: "ws1",
      taskNumber: 42,
      title: "Prepare report",
      status: "IN_REVIEW",
      priority: "HIGH",
      projectId: "p1",
      projectName: "Ops",
      assigneeId: "u1",
      assigneeName: "Ann",
      createdById: "u2",
      createdByName: "Bob",
      version: 3,
      blockedReason: "Waiting on legal",
      isBlocked: true,
      source: "MANUAL",
      rank: "0000000000001000",
    });
  });

  it("maps nested project/assignee/creator objects", () => {
    const task = mapTask({
      id: "t2",
      title: "Nested",
      project: { id: "p9", name: "Website", visibility: "PRIVATE" },
      assignee: { id: "u9", fullName: "Bob Lee", role: "manager" },
      creator: { id: "u1", fullName: "Ann" },
      completedBy: { id: "u2", fullName: "Chris" },
    });

    expect(task).toMatchObject({
      projectId: "p9",
      projectName: "Website",
      projectVisibility: "PRIVATE",
      assigneeId: "u9",
      assigneeName: "Bob Lee",
      assigneeRole: "manager",
      createdById: "u1",
      createdByName: "Ann",
      completedById: "u2",
      completedByName: "Chris",
      version: 1,
    });
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
      version: null,
    });
  });

  it("assumes success for empty bodies, keeping the requested id", () => {
    expect(mapDeleteTaskResult(null, "t9")).toEqual({
      id: "t9",
      deleted: true,
      deletedAt: null,
      version: null,
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
      { id: "p1", name: "Ops", visibility: "PRIVATE", _count: { tasks: 5 } },
      { name: "missing id" },
    ]);

    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({
      id: "p1",
      name: "Ops",
      status: "ACTIVE",
      visibility: "PRIVATE",
      totalTasks: 5,
      memberIds: [],
      members: [],
      createdById: null,
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
        startAt: "2026-07-17",
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
      startAt: "2026-07-17",
    });
    expect(result?.missingFields).toEqual(["assigneeId"]);
    expect(result?.ambiguities).toHaveLength(1);
    expect(result?.projectCandidates).toEqual([
      { id: "p1", name: "Procurement", role: null, restricted: undefined },
    ]);
    expect(result?.assigneeCandidates).toEqual([
      { id: "u1", name: "Ann Chu (a@b.co)", role: null, restricted: undefined },
    ]);
  });

  it("returns null when there is no usable draft title", () => {
    expect(mapParseResult({ draft: {} })).toBeNull();
    expect(mapParseResult(null)).toBeNull();
  });
});

describe("activity / bulk / conflict helpers", () => {
  it("maps activity lists", () => {
    const result = mapTaskActivityList(
      {
        items: [
          {
            id: "a1",
            summary: "Task created",
            actor: { fullName: "Ann" },
            createdAt: "2026-07-17T10:00:00.000Z",
          },
        ],
      },
      { pagination: { total: 1, page: 1, totalPages: 1 } },
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "a1",
      summary: "Task created",
      actorName: "Ann",
    });
    expect(result.total).toBe(1);
  });

  it("maps bulk per-item results", () => {
    const result = mapBulkMutationResult({
      results: [
        {
          taskId: "t1",
          success: true,
          task: { id: "t1", title: "One", version: 2 },
        },
        {
          taskId: "t2",
          success: false,
          error: { code: "CONFLICT", message: "stale" },
        },
      ],
    });

    expect(result.results).toHaveLength(2);
    expect(result.results[0]?.success).toBe(true);
    expect(result.results[0]?.task?.version).toBe(2);
    expect(result.results[1]).toMatchObject({
      taskId: "t2",
      success: false,
      error: { code: "CONFLICT", message: "stale" },
    });
  });

  it("detects conflict codes", () => {
    expect(isConflictError("CONFLICT")).toBe(true);
    expect(isConflictError("VERSION_CONFLICT")).toBe(true);
    expect(isConflictError("FORBIDDEN")).toBe(false);
  });
});

describe("filter URL parsing / serialization", () => {
  it("parses multi status/priority and deadline flags", () => {
    const params = new URLSearchParams(
      "status=TODO&status=DONE&priority=HIGH&tagId=tag-a&tagId=tag-b&due=overdue&unassigned=true&sortBy=dueDate&sortOrder=asc&q=report&page=2",
    );
    const state = parseTaskFilterState(params);

    expect(state.statuses).toEqual(["TODO", "DONE"]);
    expect(state.priorities).toEqual(["HIGH"]);
    expect(state.tagIds).toEqual(["tag-a", "tag-b"]);
    expect(state.due).toBe("overdue");
    expect(state.unassigned).toBe(true);
    expect(state.sortBy).toBe("dueDate");
    expect(state.sortOrder).toBe("asc");
    expect(state.search).toBe("report");
    expect(state.page).toBe(2);
  });

  it("serializes only active filter values", () => {
    const serialized = serializeTaskFilterState({
      search: "alpha",
      projectId: "p1",
      statuses: ["TODO"],
      priorities: [],
      tagIds: ["tag-a", "tag-b"],
      assigneeId: null,
      createdById: null,
      due: "today",
      deadlineFrom: null,
      deadlineTo: null,
      overdue: false,
      unassigned: false,
      includeArchived: false,
      includeDeleted: false,
      sortBy: "createdAt",
      sortOrder: "desc",
      page: 1,
    });

    expect(serialized.get("q")).toBe("alpha");
    expect(serialized.get("projectId")).toBe("p1");
    expect(serialized.getAll("status")).toEqual(["TODO"]);
    expect(serialized.getAll("tagId")).toEqual(["tag-a", "tag-b"]);
    expect(serialized.get("due")).toBe("today");
    expect(serialized.get("sortBy")).toBeNull();
    expect(serialized.get("page")).toBeNull();
  });

  it("builds list filters with default assignee and timezone", () => {
    const filters = taskFilterStateToListFilters(
      parseTaskFilterState(new URLSearchParams("status=TODO&due=today")),
      { defaultAssigneeId: "me", timezone: "Asia/Bangkok", pageSize: 20 },
    );

    expect(filters).toMatchObject({
      status: "TODO",
      due: "today",
      assigneeId: "me",
      timezone: "Asia/Bangkok",
      pageSize: 20,
    });
  });

  it("removes individual filter chips", () => {
    const state = parseTaskFilterState(
      new URLSearchParams("status=TODO&status=DONE&priority=HIGH"),
    );
    expect(removeFilterChip(state, "status:TODO").statuses).toEqual(["DONE"]);
    expect(removeFilterChip(state, "priority:HIGH").priorities).toEqual([]);
  });
});

describe("date validation", () => {
  it("requires due >= start", () => {
    expect(
      validateTaskDates("2026-07-20T00:00:00.000Z", "2026-07-18T00:00:00.000Z"),
    ).toMatch(/Deadline/);
    expect(
      validateTaskDates("2026-07-18T00:00:00.000Z", "2026-07-20T00:00:00.000Z"),
    ).toBeNull();
  });

  it("warns for past due dates", () => {
    expect(pastDueWarning("2026-07-10T00:00:00.000Z", NOW)).toMatch(/past/);
    expect(pastDueWarning("2026-07-20T00:00:00.000Z", NOW)).toBeNull();
  });

  it("formats task numbers", () => {
    expect(formatTaskNumber(12)).toBe("#12");
    expect(formatTaskNumber(null)).toBeNull();
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

describe("assignment / membership helpers", () => {
  const members = [
    { id: "u1", name: "Ann", role: "member", status: "ACTIVE" },
    { id: "u2", name: "Bob", role: "manager", status: "ACTIVE" },
    { id: "u3", name: "Inactive", role: "member", status: "DISABLED" },
  ];

  it("scopes assignees to private project members", () => {
    expect(
      filterEligibleAssignees(members, { projectVisibility: "WORKSPACE" }),
    ).toHaveLength(2);

    expect(
      filterEligibleAssignees(members, {
        projectVisibility: "PRIVATE",
        projectMemberIds: ["u2"],
      }).map((member) => member.id),
    ).toEqual(["u2"]);

    expect(
      filterEligibleAssignees(members, {
        projectVisibility: "PRIVATE",
        projectMembers: [{ id: "u1", name: "Ann", role: "member" }],
      }).map((member) => member.id),
    ).toEqual(["u1"]);
  });

  it("maps project member payloads and drops inactive", () => {
    const mapped = mapProjectMemberList([
      {
        userId: "u1",
        user: { fullName: "Ann", email: "a@x.com" },
        role: { key: "member" },
        status: "ACTIVE",
      },
      {
        userId: "u9",
        user: { fullName: "Gone" },
        status: "DISABLED",
      },
    ]);

    expect(mapped).toHaveLength(1);
    expect(mapped[0]).toMatchObject({
      userId: "u1",
      fullName: "Ann",
      roleKey: "member",
    });
  });

  it("gates private membership management to owner/admin/creator", () => {
    expect(
      canManagePrivateProjectMembers({
        roleKey: "member",
        userId: "u1",
        project: { visibility: "PRIVATE", createdById: "u1" },
      }),
    ).toBe(true);
    expect(
      canManagePrivateProjectMembers({
        roleKey: "manager",
        userId: "u2",
        project: { visibility: "PRIVATE", createdById: "u1" },
      }),
    ).toBe(false);
    expect(
      canManagePrivateProjectMembers({
        roleKey: "admin",
        userId: "u2",
        project: { visibility: "PRIVATE", createdById: "u1" },
      }),
    ).toBe(true);
  });

  it("treats member role as self-assign only", () => {
    expect(canAssignToOtherMembers("owner")).toBe(true);
    expect(canAssignToOtherMembers("member")).toBe(false);
    expect(hasWorkspaceTaskScope("manager")).toBe(true);
  });

  it("builds initials and view presets", () => {
    expect(initialsFromName("Ann Lee")).toBe("AL");
    expect(initialsFromName("Ann")).toBe("AN");
    expect(resolveTaskListViewPreset({ includeArchived: false, includeDeleted: true })).toBe(
      "trash",
    );
    expect(taskListViewPresetToFilterPatch("archived")).toEqual({
      includeArchived: true,
      includeDeleted: false,
      page: 1,
    });
  });
});

describe("Phase 6 view URL + board helpers", () => {
  it("parses and serializes view URL state with defaults omitted", () => {
    const parsed = parseTaskViewUrlState(
      new URLSearchParams("view=board&calMode=week&tlZoom=month&groupBy=assignee"),
    );
    expect(parsed).toEqual({
      view: "board",
      calMode: "week",
      tlZoom: "month",
      groupBy: "assignee",
    });

    const serialized = serializeTaskViewUrlState(parsed);
    expect(serialized.get("view")).toBe("board");
    expect(serialized.get("calMode")).toBe("week");
    expect(serialized.get("tlZoom")).toBe("month");
    expect(serialized.get("groupBy")).toBe("assignee");

    const defaults = serializeTaskViewUrlState({
      view: "list",
      calMode: "month",
      tlZoom: "week",
      groupBy: "project",
    });
    expect(defaults.toString()).toBe("");
  });

  it("gates mutate permission like the backend", () => {
    expect(
      canMutateTask("member", "u1", { assigneeId: "u1", createdById: "u9" }),
    ).toBe(true);
    expect(
      canMutateTask("member", "u1", { assigneeId: "u2", createdById: "u9" }),
    ).toBe(false);
    expect(
      canMutateTask("manager", "u1", { assigneeId: "u2", createdById: "u9" }),
    ).toBe(true);
  });

  it("resolves board neighbors for a drop", () => {
    const column = [
      { id: "a" },
      { id: "b" },
      { id: "c" },
    ] as unknown as import("./tasks.types").TaskRecord[];

    expect(resolveBoardMoveNeighbors(column, "a", "c")).toEqual({
      beforeTaskId: "b",
      afterTaskId: "c",
    });
    expect(resolveBoardMoveNeighbors(column, "c", null)).toEqual({
      beforeTaskId: "b",
      afterTaskId: null,
    });
  });

  it("detects multi-day overlap and maps calendar/timeline payloads", () => {
    expect(
      taskOverlapsDay(
        { startAt: "2026-07-18T00:00:00.000Z", dueDate: "2026-07-20T00:00:00.000Z" },
        "2026-07-19",
      ),
    ).toBe(true);
    expect(
      taskOverlapsDay(
        { startAt: null, dueDate: "2026-07-20T00:00:00.000Z" },
        "2026-07-19",
      ),
    ).toBe(false);

    const calendar = mapCalendarTasksResult(
      { items: [{ id: "t1", title: "A", rank: "1" }] },
      { unscheduledCount: 3, timezone: "UTC", from: "2026-07-01", to: "2026-07-31" },
    );
    expect(calendar.unscheduledCount).toBe(3);
    expect(calendar.items[0]?.rank).toBe("1");

    const timeline = mapTimelineTasksResult(
      {
        groups: [
          {
            id: "p1",
            label: "Ops",
            items: [{ id: "t1", title: "A" }],
          },
        ],
      },
      { groupBy: "project", total: 1 },
    );
    expect(timeline.groups[0]?.label).toBe("Ops");
    expect(timeline.groupBy).toBe("project");
  });

  it("round-trips saved view ↔ page state", () => {
    const view = mapSavedView({
      id: "v1",
      workspaceId: "ws1",
      ownerUserId: "u1",
      name: "Board overdue",
      viewType: "BOARD",
      filtersJson: { statuses: ["TODO"], overdue: true },
      sortJson: { sortBy: "dueDate", sortOrder: "asc" },
      groupByJson: { groupBy: "none" },
      columnsJson: ["title"],
      displayOptionsJson: { view: "board", calMode: "week" },
      isDefault: true,
    });
    expect(view?.name).toBe("Board overdue");

    const page = savedViewToPageState(view!);
    expect(page.view.view).toBe("board");
    expect(page.filters.overdue).toBe(true);
    expect(page.filters.sortBy).toBe("dueDate");

    const payload = pageStateToSavedViewInput(
      {
        ...parseTaskFilterState(new URLSearchParams("status=TODO&overdue=true")),
        sortBy: "dueDate",
        sortOrder: "asc",
      },
      { view: "board", calMode: "week", tlZoom: "week", groupBy: "project" },
      ["title"],
    );
    expect(payload.viewType).toBe("BOARD");
    expect(payload.displayOptionsJson.view).toBe("board");
  });
});

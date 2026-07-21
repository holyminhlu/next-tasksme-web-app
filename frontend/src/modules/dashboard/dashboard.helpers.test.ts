import { describe, expect, it } from "vitest";
import {
  dateRangeForPreset,
  greetingForHour,
  mapActivityList,
  mapCharts,
  mapSummary,
  myTasksHref,
} from "./dashboard.helpers";

const NOW = new Date(2026, 6, 17, 12, 0, 0); // Jul 17, 2026

describe("dateRangeForPreset", () => {
  it("computes preset ranges", () => {
    expect(dateRangeForPreset("today", NOW)).toEqual({
      from: "2026-07-17",
      to: "2026-07-17",
    });
    expect(dateRangeForPreset("last7", NOW)).toEqual({
      from: "2026-07-11",
      to: "2026-07-17",
    });
    expect(dateRangeForPreset("last30", NOW)).toEqual({
      from: "2026-06-18",
      to: "2026-07-17",
    });
    expect(dateRangeForPreset("thisMonth", NOW)).toEqual({
      from: "2026-07-01",
      to: "2026-07-17",
    });
    expect(dateRangeForPreset("all", NOW)).toEqual({ from: null, to: null });
  });
});

describe("greetingForHour", () => {
  it("varies by time of day", () => {
    expect(greetingForHour(3)).toBe("Working late");
    expect(greetingForHour(9)).toBe("Good morning");
    expect(greetingForHour(14)).toBe("Good afternoon");
    expect(greetingForHour(20)).toBe("Good evening");
  });
});

describe("myTasksHref", () => {
  it("builds drill-down links, skipping empty params", () => {
    expect(myTasksHref({ status: "TODO" })).toBe("/my-tasks?status=TODO");
    expect(myTasksHref({ due: "overdue", projectId: "p1" })).toBe(
      "/my-tasks?due=overdue&projectId=p1",
    );
    expect(myTasksHref({})).toBe("/my-tasks");
  });
});

describe("mapSummary", () => {
  it("maps the documented contract including meta.generatedAt", () => {
    const summary = mapSummary(
      {
        scope: {
          workspaceId: "w1",
          from: "2026-07-01",
          to: "2026-07-17",
          timezone: "Asia/Bangkok",
          workspaceScope: "member",
        },
        stats: {
          openTasks: 4,
          dueToday: 1,
          overdue: 2,
          completed: 9,
          activeProjects: 3,
          unassignedTasks: 5,
          blockedTasks: 1,
        },
      },
      { generatedAt: "2026-07-17T05:00:00.000Z" },
    );

    expect(summary.scope.workspaceId).toBe("w1");
    expect(summary.scope.workspaceScope).toBe("member");
    expect(summary.stats).toEqual({
      openTasks: 4,
      dueToday: 1,
      overdue: 2,
      completed: 9,
      activeProjects: 3,
      unassignedTasks: 5,
      blockedTasks: 1,
    });
    expect(summary.generatedAt).toBe("2026-07-17T05:00:00.000Z");
  });

  it("defaults numbers and keeps optional stats null", () => {
    const summary = mapSummary({}, undefined);
    expect(summary.stats.openTasks).toBe(0);
    expect(summary.stats.unassignedTasks).toBeNull();
    expect(summary.stats.blockedTasks).toBeNull();
    expect(summary.generatedAt).toBeNull();
  });
});

describe("mapCharts", () => {
  it("maps all chart series and skips malformed points", () => {
    const charts = mapCharts({
      tasksByStatus: [
        { status: "TODO", count: 4 },
        { status: "bogus-status", count: 1 },
      ],
      tasksByCategory: [
        { category: "IN_PROGRESS", count: 5 },
        { category: "bogus-category", count: 1 },
      ],
      completionTrend: [{ date: "2026-07-16", count: 2 }, { count: 3 }],
      overdueByProject: [
        { projectId: "p1", projectName: "Ops", count: 2 },
        { count: 1 },
      ],
      teamWorkload: [
        { memberId: "m1", memberName: "Ann", openTasks: 3, overdueTasks: 1 },
      ],
    });

    expect(charts.tasksByStatus).toEqual([{ status: "TODO", count: 4 }]);
    expect(charts.tasksByCategory).toEqual([{ category: "IN_PROGRESS", count: 5 }]);
    expect(charts.completionTrend).toEqual([{ date: "2026-07-16", count: 2 }]);
    expect(charts.overdueByProject).toHaveLength(2);
    expect(charts.overdueByProject[1].projectName).toBe("Unknown project");
    expect(charts.teamWorkload).toEqual([
      { memberId: "m1", memberName: "Ann", openTasks: 3, overdueTasks: 1 },
    ]);
    expect(charts.available).toBe(true);
  });

  it("returns null teamWorkload when the backend omits it", () => {
    const charts = mapCharts({ tasksByStatus: [] });
    expect(charts.available).toBe(true);
    expect(charts.teamWorkload).toBeNull();
  });

  it("maps available:false as an empty restricted payload", () => {
    const charts = mapCharts({ available: false });
    expect(charts).toEqual({
      available: false,
      tasksByStatus: [],
      tasksByCategory: [],
      completionTrend: [],
      overdueByProject: [],
      teamWorkload: null,
    });
  });
});

describe("mapActivityList", () => {
  it("maps bare arrays with pagination meta", () => {
    const result = mapActivityList(
      [
        {
          id: "e1",
          actorName: "Ann",
          action: "task.completed",
          summary: "Ann completed 'Ship it'",
          createdAt: "2026-07-17T04:00:00.000Z",
        },
      ],
      { pagination: { page: 2, pageSize: 10, total: 25, totalPages: 3 } },
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].summary).toBe("Ann completed 'Ship it'");
    expect(result.page).toBe(2);
    expect(result.total).toBe(25);
    expect(result.totalPages).toBe(3);
  });

  it("tolerates {items} payloads and nested actors", () => {
    const result = mapActivityList({
      items: [
        {
          id: "e2",
          actor: { fullName: "Bob" },
          summary: "Bob created a task",
        },
      ],
      total: 1,
    });

    expect(result.items[0].actorName).toBe("Bob");
    expect(result.total).toBe(1);
  });
});

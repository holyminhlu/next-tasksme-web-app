import request from "supertest";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/config/database.js";
import { registerLoginAndCreateWorkspace } from "./helpers.js";

describe("phase 6 visualization, saved views, export", () => {
  it("moves tasks by rank with optimistic concurrency", async () => {
    const owner = await registerLoginAndCreateWorkspace({
      timezone: "Asia/Ho_Chi_Minh",
    });
    const base = `/api/v1/workspaces/${owner.workspaceId}/tasks`;

    const a = await request(owner.app)
      .post(base)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ title: "Card A", status: "TODO" });
    const b = await request(owner.app)
      .post(base)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ title: "Card B", status: "TODO" });
    const c = await request(owner.app)
      .post(base)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ title: "Card C", status: "TODO" });
    expect([a.status, b.status, c.status]).toEqual([201, 201, 201]);

    const moved = await request(owner.app)
      .patch(`${base}/${c.body.data.id}/move`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        targetStatus: "IN_PROGRESS",
        version: c.body.data.version,
      });
    expect(moved.status).toBe(200);
    expect(moved.body.data.status).toBe("IN_PROGRESS");
    expect(moved.body.data.version).toBe(c.body.data.version + 1);

    const reordered = await request(owner.app)
      .patch(`${base}/${b.body.data.id}/move`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        targetStatus: "TODO",
        beforeTaskId: null,
        afterTaskId: a.body.data.id,
        version: b.body.data.version,
      });
    expect(reordered.status).toBe(200);
    expect(reordered.body.data.rank < a.body.data.rank).toBe(true);

    const stale = await request(owner.app)
      .patch(`${base}/${b.body.data.id}/move`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        targetStatus: "DONE",
        version: b.body.data.version,
      });
    expect(stale.status).toBe(409);

    const board = await request(owner.app)
      .get(`${base}/board`)
      .query({ status: "TODO", sortBy: "rank", sortOrder: "asc" })
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(board.status).toBe(200);
    expect(board.body.data.map((item: { title: string }) => item.title)).toEqual([
      "Card B",
      "Card A",
    ]);
  });

  it("returns calendar and timeline ranges with timezone awareness", async () => {
    const owner = await registerLoginAndCreateWorkspace({
      timezone: "Asia/Ho_Chi_Minh",
    });
    const base = `/api/v1/workspaces/${owner.workspaceId}/tasks`;

    await request(owner.app)
      .post(base)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        title: "Multi-day",
        startAt: "2026-07-10T00:00:00.000Z",
        dueDate: "2026-07-12T00:00:00.000Z",
      });
    await request(owner.app)
      .post(base)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ title: "Unscheduled only" });

    const calendar = await request(owner.app)
      .get(`${base}/calendar`)
      .query({
        from: "2026-07-01",
        to: "2026-07-31",
        timezone: "Asia/Ho_Chi_Minh",
      })
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(calendar.status).toBe(200);
    expect(calendar.body.data.some((item: { title: string }) => item.title === "Multi-day")).toBe(
      true,
    );
    expect(calendar.body.meta.unscheduledCount).toBeGreaterThanOrEqual(1);

    const timeline = await request(owner.app)
      .get(`${base}/timeline`)
      .query({
        from: "2026-07-01",
        to: "2026-07-31",
        groupBy: "project",
        timezone: "Asia/Ho_Chi_Minh",
      })
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(timeline.status).toBe(200);
    expect(Array.isArray(timeline.body.data)).toBe(true);
    expect(
      timeline.body.data.some((group: { items: Array<{ title: string }> }) =>
        group.items.some((item) => item.title === "Multi-day"),
      ),
    ).toBe(true);
  });

  it("manages private saved views with validated config", async () => {
    const owner = await registerLoginAndCreateWorkspace();
    const base = `/api/v1/workspaces/${owner.workspaceId}/saved-views`;

    const created = await request(owner.app)
      .post(base)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        name: "My Board",
        viewType: "BOARD",
        filtersJson: { statuses: ["TODO"], search: "report" },
        sortJson: { sortBy: "rank", sortOrder: "asc" },
        displayOptionsJson: { view: "board" },
        isDefault: true,
      });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      name: "My Board",
      viewType: "BOARD",
      visibility: "PRIVATE",
      isDefault: true,
      configVersion: 1,
    });

    const invalid = await request(owner.app)
      .post(base)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        name: "Bad",
        filtersJson: { statuses: ["NOT_A_STATUS"] },
      });
    expect(invalid.status).toBe(400);

    const listed = await request(owner.app)
      .get(base)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);

    const updated = await request(owner.app)
      .patch(`${base}/${created.body.data.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Board v2" });
    expect(updated.status).toBe(200);
    expect(updated.body.data.name).toBe("Board v2");
    expect(updated.body.data.configVersion).toBe(2);

    const removed = await request(owner.app)
      .delete(`${base}/${created.body.data.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(removed.status).toBe(200);
  });

  it("exports CSV with formula sanitization, row scope, and audit", async () => {
    const owner = await registerLoginAndCreateWorkspace({
      timezone: "UTC",
    });
    const base = `/api/v1/workspaces/${owner.workspaceId}/tasks`;

    const created = await request(owner.app)
      .post(base)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ title: "=1+2 Dangerous" });
    expect(created.status).toBe(201);

    const exported = await request(owner.app)
      .post(`${base}/export`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        format: "csv",
        scope: "filters",
        columns: ["taskNumber", "title", "status"],
        timezone: "UTC",
        dateFormat: "iso",
      });
    expect(exported.status).toBe(200);
    expect(exported.headers["content-type"]).toContain("text/csv");
    const body = exported.text;
    expect(body).toContain("'=1+2 Dangerous");
    expect(body).not.toMatch(/(^|,)=1\+2 Dangerous/);

    const audit = await prisma.auditLog.findFirst({
      where: {
        workspaceId: owner.workspaceId,
        action: "tasks.exported",
      },
    });
    expect(audit).toBeTruthy();
    expect(audit?.userId).toBe(owner.userId);
  });

  it("keeps export and saved views isolated across workspaces", async () => {
    const ownerA = await registerLoginAndCreateWorkspace({ name: "Workspace A" });
    const ownerB = await registerLoginAndCreateWorkspace({ name: "Workspace B" });

    await request(ownerA.app)
      .post(`/api/v1/workspaces/${ownerA.workspaceId}/tasks`)
      .set("Authorization", `Bearer ${ownerA.accessToken}`)
      .send({ title: "Secret A" });

    const view = await request(ownerA.app)
      .post(`/api/v1/workspaces/${ownerA.workspaceId}/saved-views`)
      .set("Authorization", `Bearer ${ownerA.accessToken}`)
      .send({ name: "Private A", viewType: "LIST" });
    expect(view.status).toBe(201);

    const leakedView = await request(ownerB.app)
      .get(`/api/v1/workspaces/${ownerA.workspaceId}/saved-views/${view.body.data.id}`)
      .set("Authorization", `Bearer ${ownerB.accessToken}`);
    expect([401, 403, 404]).toContain(leakedView.status);

    const exportB = await request(ownerB.app)
      .post(`/api/v1/workspaces/${ownerB.workspaceId}/tasks/export`)
      .set("Authorization", `Bearer ${ownerB.accessToken}`)
      .send({ format: "csv", scope: "filters" });
    expect(exportB.status).toBe(200);
    expect(exportB.text).not.toContain("Secret A");
  });
});

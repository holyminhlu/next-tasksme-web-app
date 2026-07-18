import type { Express } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/config/database.js";
import { registerAndLogin, registerLoginAndCreateWorkspace } from "./helpers.js";

async function addMember(
  app: Express,
  workspaceId: string,
  roleKey: "member" | "manager" | "admin",
) {
  const session = await registerAndLogin(
    { email: `${roleKey}-${Date.now()}-${Math.random()}@example.com` },
    app,
  );
  const role = await prisma.role.findUniqueOrThrow({
    where: { workspaceId_key: { workspaceId, key: roleKey } },
  });
  await prisma.workspaceMember.create({
    data: {
      workspaceId,
      userId: session.userId!,
      roleId: role.id,
      status: "ACTIVE",
    },
  });
  return session;
}

describe("phase 5 core task management", () => {
  it("allocates unique workspace task numbers under concurrent creates", async () => {
    const owner = await registerLoginAndCreateWorkspace();
    const base = `/api/v1/workspaces/${owner.workspaceId}/tasks`;
    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        request(owner.app)
          .post(base)
          .set("Authorization", `Bearer ${owner.accessToken}`)
          .send({ title: `Concurrent ${index}` }),
      ),
    );
    expect(responses.every((response) => response.status === 201)).toBe(true);
    const numbers = responses.map((response) => response.body.data.taskNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(numbers.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("supports CRUD fields, filtering, lifecycle, and optimistic conflicts", async () => {
    const owner = await registerLoginAndCreateWorkspace();
    const base = `/api/v1/workspaces/${owner.workspaceId}/tasks`;
    const created = await request(owner.app)
      .post(base)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        title: "Review quarterly plan",
        status: "IN_REVIEW",
        priority: "URGENT",
        startAt: "2026-07-01T00:00:00.000Z",
        dueDate: "2026-07-20T00:00:00.000Z",
      });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      taskNumber: 1,
      status: "IN_REVIEW",
      isBlocked: false,
      version: 1,
    });

    const invalidDates = await request(owner.app)
      .post(base)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        title: "Invalid dates",
        startAt: "2026-07-20T00:00:00.000Z",
        dueDate: "2026-07-01T00:00:00.000Z",
      });
    expect(invalidDates.status).toBe(400);

    const filtered = await request(owner.app)
      .get(base)
      .query({
        search: String(created.body.data.taskNumber),
        status: "IN_REVIEW",
        priority: "URGENT",
        sortBy: "priority",
        sortOrder: "desc",
        page: 1,
        pageSize: 1,
      })
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(filtered.status).toBe(200);
    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.meta.pagination.total).toBe(1);

    const completed = await request(owner.app)
      .patch(`${base}/${created.body.data.id}/status`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ status: "DONE", version: created.body.data.version });
    expect(completed.status).toBe(200);
    expect(completed.body.data.completedAt).toBeTruthy();
    expect(completed.body.data.completedBy.id).toBe(owner.userId);

    const stale = await request(owner.app)
      .patch(`${base}/${created.body.data.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ title: "Stale", version: created.body.data.version });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("CONFLICT");

    const archived = await request(owner.app)
      .post(`${base}/${created.body.data.id}/archive`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ version: completed.body.data.version });
    expect(archived.status).toBe(200);
    expect(archived.body.data.archivedAt).toBeTruthy();

    const defaultList = await request(owner.app)
      .get(base)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(defaultList.body.data).toHaveLength(0);

    const unarchived = await request(owner.app)
      .post(`${base}/${created.body.data.id}/unarchive`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ version: archived.body.data.version });
    const deleted = await request(owner.app)
      .delete(`${base}/${created.body.data.id}`)
      .query({ version: unarchived.body.data.version })
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(deleted.status).toBe(200);

    const restored = await request(owner.app)
      .post(`${base}/${created.body.data.id}/restore`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ version: deleted.body.data.version });
    expect(restored.status).toBe(200);
    expect(restored.body.data.deletedAt).toBeNull();

    const activity = await request(owner.app)
      .get(`${base}/${created.body.data.id}/activity`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(activity.status).toBe(200);
    expect(activity.body.data.map((event: { action: string }) => event.action)).toEqual(
      expect.arrayContaining([
        "task.created",
        "task.completed",
        "task.archived",
        "task.unarchived",
        "task.deleted",
        "task.restored",
      ]),
    );
  });

  it("enforces private project membership and assignment notification dedupe", async () => {
    const owner = await registerLoginAndCreateWorkspace();
    const member = await addMember(owner.app, owner.workspaceId!, "member");
    const manager = await addMember(owner.app, owner.workspaceId!, "manager");
    const project = await request(owner.app)
      .post(`/api/v1/workspaces/${owner.workspaceId}/projects`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        name: "Private delivery",
        visibility: "PRIVATE",
        memberIds: [member.userId],
      });
    expect(project.status).toBe(201);
    expect(project.body.data.memberIds).toEqual(
      expect.arrayContaining([owner.userId, member.userId]),
    );

    const task = await request(owner.app)
      .post(`/api/v1/workspaces/${owner.workspaceId}/tasks`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        title: "Private assignment",
        projectId: project.body.data.id,
        assigneeId: member.userId,
      });
    expect(task.status).toBe(201);
    expect(
      await prisma.notification.count({ where: { taskId: task.body.data.id } }),
    ).toBe(1);

    const unchanged = await request(owner.app)
      .patch(
        `/api/v1/workspaces/${owner.workspaceId}/tasks/${task.body.data.id}/assignee`,
      )
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ assigneeId: member.userId, version: task.body.data.version });
    expect(unchanged.status).toBe(200);
    expect(
      await prisma.notification.count({ where: { taskId: task.body.data.id } }),
    ).toBe(1);

    const managerList = await request(owner.app)
      .get(`/api/v1/workspaces/${owner.workspaceId}/tasks`)
      .set("Authorization", `Bearer ${manager.accessToken}`);
    expect(managerList.status).toBe(200);
    expect(managerList.body.data).toHaveLength(0);

    const invalidPrivateAssignee = await request(owner.app)
      .patch(
        `/api/v1/workspaces/${owner.workspaceId}/tasks/${task.body.data.id}/assignee`,
      )
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ assigneeId: manager.userId, version: unchanged.body.data.version });
    expect(invalidPrivateAssignee.status).toBe(400);

    const memberAssignOther = await request(owner.app)
      .patch(
        `/api/v1/workspaces/${owner.workspaceId}/tasks/${task.body.data.id}/assignee`,
      )
      .set("Authorization", `Bearer ${member.accessToken}`)
      .send({ assigneeId: manager.userId, version: unchanged.body.data.version });
    expect(memberAssignOther.status).toBe(403);
  });

  it("returns per-item bulk outcomes without bypassing concurrency", async () => {
    const owner = await registerLoginAndCreateWorkspace();
    const base = `/api/v1/workspaces/${owner.workspaceId}/tasks`;
    const one = await request(owner.app)
      .post(base)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ title: "Bulk one" });
    const two = await request(owner.app)
      .post(base)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ title: "Bulk two" });

    const bulk = await request(owner.app)
      .post(`${base}/bulk-update`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        items: [
          {
            taskId: one.body.data.id,
            version: one.body.data.version,
            changes: { status: "BLOCKED" },
          },
          {
            taskId: two.body.data.id,
            version: 999,
            changes: { priority: "HIGH" },
          },
        ],
      });
    expect(bulk.status).toBe(200);
    expect(bulk.body.data.results).toMatchObject([
      { success: true },
      { success: false, error: { code: "CONFLICT" } },
    ]);
  });

  it("supports tenant-scoped notification preferences and suppresses assignments", async () => {
    const owner = await registerLoginAndCreateWorkspace();
    const member = await addMember(owner.app, owner.workspaceId!, "member");
    const preferences = `/api/v1/workspaces/${owner.workspaceId}/notifications/preferences`;

    const defaults = await request(owner.app)
      .get(preferences)
      .set("Authorization", `Bearer ${member.accessToken}`);
    expect(defaults.status).toBe(200);
    expect(defaults.body.data.taskAssigned).toBe(true);

    const disabled = await request(owner.app)
      .patch(preferences)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .send({ taskAssigned: false });
    expect(disabled.status).toBe(200);
    expect(disabled.body.data.taskAssigned).toBe(false);

    const task = await request(owner.app)
      .post(`/api/v1/workspaces/${owner.workspaceId}/tasks`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ title: "Muted assignment", assigneeId: member.userId });
    expect(task.status).toBe(201);
    expect(
      await prisma.notification.count({
        where: { workspaceId: owner.workspaceId!, userId: member.userId! },
      }),
    ).toBe(0);

    const other = await registerLoginAndCreateWorkspace();
    const cross = await request(owner.app)
      .get(`/api/v1/workspaces/${other.workspaceId}/notifications/preferences`)
      .set("Authorization", `Bearer ${member.accessToken}`);
    expect(cross.status).toBe(403);
  });

  it("manages private membership and exposes only active eligible assignees", async () => {
    const owner = await registerLoginAndCreateWorkspace();
    const manager = await addMember(owner.app, owner.workspaceId!, "manager");
    const member = await addMember(owner.app, owner.workspaceId!, "member");
    const inactive = await addMember(owner.app, owner.workspaceId!, "member");
    await prisma.workspaceMember.update({
      where: {
        workspaceId_userId: {
          workspaceId: owner.workspaceId!,
          userId: inactive.userId!,
        },
      },
      data: { status: "DISABLED" },
    });
    const project = await request(owner.app)
      .post(`/api/v1/workspaces/${owner.workspaceId}/projects`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .send({
        name: "Manager private project",
        visibility: "PRIVATE",
        memberIds: [member.userId],
      });
    expect(project.status).toBe(201);
    expect(project.body.data.creator.id).toBe(manager.userId);
    expect(project.body.data.memberIds).toEqual(
      expect.arrayContaining([manager.userId, member.userId]),
    );

    const base = `/api/v1/workspaces/${owner.workspaceId}/projects/${project.body.data.id}`;
    const members = await request(owner.app)
      .get(`${base}/members`)
      .set("Authorization", `Bearer ${member.accessToken}`);
    expect(members.status).toBe(200);
    expect(members.body.data[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        fullName: expect.any(String),
        email: expect.any(String),
        role: expect.any(String),
        status: "ACTIVE",
      }),
    );

    const removeCreator = await request(owner.app)
      .put(`${base}/members`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .send({ memberIds: [member.userId] });
    expect(removeCreator.status).toBe(400);

    const inactiveRejected = await request(owner.app)
      .put(`${base}/members`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .send({ memberIds: [manager.userId, inactive.userId] });
    expect(inactiveRejected.status).toBe(400);

    const other = await registerLoginAndCreateWorkspace();
    const crossWorkspace = await request(owner.app)
      .put(`${base}/members`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .send({ memberIds: [manager.userId, other.userId] });
    expect(crossWorkspace.status).toBe(400);

    const eligible = await request(owner.app)
      .get(`${base}/eligible-assignees`)
      .set("Authorization", `Bearer ${member.accessToken}`);
    expect(eligible.status).toBe(200);
    expect(eligible.body.data.map((item: { id: string }) => item.id)).toEqual(
      expect.arrayContaining([manager.userId, member.userId]),
    );
    expect(eligible.body.data.map((item: { id: string }) => item.id)).not.toContain(
      inactive.userId,
    );

    const outsiderManager = await addMember(owner.app, owner.workspaceId!, "manager");
    const hidden = await request(owner.app)
      .get(base)
      .set("Authorization", `Bearer ${outsiderManager.accessToken}`);
    expect(hidden.status).toBe(404);
  });

  it("prevents members from assigning others through generic and bulk updates", async () => {
    const owner = await registerLoginAndCreateWorkspace();
    const member = await addMember(owner.app, owner.workspaceId!, "member");
    const other = await addMember(owner.app, owner.workspaceId!, "member");
    const created = await request(owner.app)
      .post(`/api/v1/workspaces/${owner.workspaceId}/tasks`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .send({ title: "Member-owned task" });
    expect(created.status).toBe(201);

    const generic = await request(owner.app)
      .patch(`/api/v1/workspaces/${owner.workspaceId}/tasks/${created.body.data.id}`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .send({
        version: created.body.data.version,
        assigneeId: other.userId,
      });
    expect(generic.status).toBe(403);

    const bulk = await request(owner.app)
      .post(`/api/v1/workspaces/${owner.workspaceId}/tasks/bulk-update`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .send({
        items: [
          {
            taskId: created.body.data.id,
            version: created.body.data.version,
            changes: { assigneeId: other.userId },
          },
        ],
      });
    expect(bulk.status).toBe(200);
    expect(bulk.body.data.results[0]).toMatchObject({
      success: false,
      error: { code: "FORBIDDEN" },
    });
  });
});

import request from "supertest";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/config/database.js";
import { registerLoginAndCreateWorkspace } from "./helpers.js";

describe("phase 5 tenant isolation", () => {
  it("blocks cross-workspace task, bulk, private project, and notification access", async () => {
    const tenantA = await registerLoginAndCreateWorkspace();
    const tenantB = await registerLoginAndCreateWorkspace();
    const authA = { Authorization: `Bearer ${tenantA.accessToken}` };
    const taskBaseB = `/api/v1/workspaces/${tenantB.workspaceId}/tasks`;

    const created = await request(tenantB.app)
      .post(taskBaseB)
      .set("Authorization", `Bearer ${tenantB.accessToken}`)
      .send({ title: "Tenant B task" });
    expect(created.status).toBe(201);
    const taskId = created.body.data.id as string;
    const version = created.body.data.version as number;

    const attempts = await Promise.all([
      request(tenantA.app).get(`${taskBaseB}/${taskId}`).set(authA),
      request(tenantA.app)
        .patch(`${taskBaseB}/${taskId}`)
        .set(authA)
        .send({ title: "Cross update", version }),
      request(tenantA.app).delete(`${taskBaseB}/${taskId}`).query({ version }).set(authA),
      request(tenantA.app)
        .post(`${taskBaseB}/${taskId}/restore`)
        .set(authA)
        .send({ version }),
      request(tenantA.app)
        .post(`${taskBaseB}/bulk-update`)
        .set(authA)
        .send({
          items: [{ taskId, version, changes: { priority: "HIGH" } }],
        }),
      request(tenantA.app)
        .post(`${taskBaseB}/bulk-delete`)
        .set(authA)
        .send({ items: [{ taskId, version }] }),
    ]);
    expect(attempts.every((response) => response.status === 403)).toBe(true);

    const project = await request(tenantB.app)
      .post(`/api/v1/workspaces/${tenantB.workspaceId}/projects`)
      .set("Authorization", `Bearer ${tenantB.accessToken}`)
      .send({ name: "Tenant B private", visibility: "PRIVATE" });
    expect(project.status).toBe(201);
    const projectBase = `/api/v1/workspaces/${tenantB.workspaceId}/projects/${project.body.data.id}`;
    for (const path of [
      projectBase,
      `${projectBase}/members`,
      `${projectBase}/eligible-assignees`,
    ]) {
      const response = await request(tenantA.app).get(path).set(authA);
      expect(response.status).toBe(403);
    }
    const replace = await request(tenantA.app)
      .put(`${projectBase}/members`)
      .set(authA)
      .send({ memberIds: [tenantB.userId] });
    expect(replace.status).toBe(403);

    const notification = await prisma.notification.create({
      data: {
        workspaceId: tenantB.workspaceId!,
        userId: tenantB.userId!,
        taskId,
        type: "TASK_ASSIGNED",
        title: "Tenant B notification",
        dedupeKey: `tenant-isolation:${taskId}`,
      },
    });
    const notificationBase = `/api/v1/workspaces/${tenantB.workspaceId}/notifications`;
    const notificationAttempts = await Promise.all([
      request(tenantA.app).get(notificationBase).set(authA),
      request(tenantA.app).get(`${notificationBase}/preferences`).set(authA),
      request(tenantA.app)
        .patch(`${notificationBase}/preferences`)
        .set(authA)
        .send({ taskAssigned: false }),
      request(tenantA.app)
        .patch(`${notificationBase}/${notification.id}/read`)
        .set(authA),
    ]);
    expect(notificationAttempts.every((response) => response.status === 403)).toBe(true);
  });
});

import request from "supertest";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/config/database.js";
import { registerLoginAndCreateWorkspace } from "./helpers.js";

describe("phase 8.1 project lifecycle", () => {
  async function setup(name: string) {
    const owner = await registerLoginAndCreateWorkspace({ name });
    const workspaceId = owner.workspaceId as string;
    const base = `/api/v1/workspaces/${workspaceId}/projects`;
    const auth = { Authorization: `Bearer ${owner.accessToken}` };
    return { owner, workspaceId, base, auth };
  }

  it("creates projects with code, manager, and owner membership", async () => {
    const { owner, base, auth } = await setup("Project Create");
    const response = await request(owner.app)
      .post(base)
      .set(auth)
      .send({
        name: "Platform rollout",
        code: "PRJ-001",
        status: "PLANNING",
        priority: "HIGH",
        visibility: "WORKSPACE",
        managerId: owner.userId,
      });
    expect(response.status).toBe(201);
    expect(response.body.data.code).toBe("PRJ-001");
    expect(response.body.data.status).toBe("PLANNING");
    expect(response.body.data.managerId).toBe(owner.userId);
    expect(
      response.body.data.members.some(
        (member: { userId: string; projectRole: string }) =>
          member.userId === owner.userId && member.projectRole === "PROJECT_OWNER",
      ),
    ).toBe(true);
  });

  it("lists projects with search, pagination, and stats", async () => {
    const { owner, base, auth } = await setup("Project List");
    await request(owner.app)
      .post(base)
      .set(auth)
      .send({ name: "Alpha", code: "ALPHA" });
    const listed = await request(owner.app)
      .get(`${base}?search=Alpha&page=1&pageSize=10`)
      .set(auth);
    expect(listed.status).toBe(200);
    expect(Array.isArray(listed.body.data)).toBe(true);
    expect(listed.body.data.length).toBeGreaterThan(0);
    expect(listed.body.meta.pagination.total).toBeGreaterThan(0);
  });

  it("supports update, archive, delete, and restore lifecycle", async () => {
    const { owner, base, auth } = await setup("Project Lifecycle");
    const created = await request(owner.app)
      .post(base)
      .set(auth)
      .send({ name: "Lifecycle", status: "ACTIVE" });
    const projectId = created.body.data.id as string;

    const updated = await request(owner.app)
      .patch(`${base}/${projectId}`)
      .set(auth)
      .send({ name: "Lifecycle updated", priority: "URGENT" });
    expect(updated.status).toBe(200);
    expect(updated.body.data.name).toBe("Lifecycle updated");

    const archived = await request(owner.app)
      .post(`${base}/${projectId}/archive`)
      .set(auth)
      .send({});
    expect(archived.status).toBe(200);
    expect(archived.body.data.status).toBe("ARCHIVED");

    const deleted = await request(owner.app)
      .delete(`${base}/${projectId}`)
      .set(auth);
    expect(deleted.status).toBe(200);
    expect(deleted.body.data.deletedAt).toBeTruthy();

    const restored = await request(owner.app)
      .post(`${base}/${projectId}/restore`)
      .set(auth)
      .send({});
    expect(restored.status).toBe(200);
    expect(restored.body.data.deletedAt).toBeNull();
  });

  it("blocks completion when open tasks exist under BLOCK policy", async () => {
    const { owner, workspaceId, base, auth } = await setup("Project Complete");
    const project = await request(owner.app)
      .post(base)
      .set(auth)
      .send({
        name: "Completion gate",
        status: "ACTIVE",
        completionPolicy: "BLOCK",
      });
    const projectId = project.body.data.id as string;
    await request(owner.app)
      .post(`/api/v1/workspaces/${workspaceId}/tasks`)
      .set(auth)
      .send({ title: "Still open", projectId, status: "TODO" });

    const blocked = await request(owner.app)
      .patch(`${base}/${projectId}`)
      .set(auth)
      .send({ status: "COMPLETED" });
    expect(blocked.status).toBe(400);

    await prisma.task.updateMany({
      where: { projectId },
      data: { status: "DONE", completedAt: new Date() },
    });

    const completed = await request(owner.app)
      .patch(`${base}/${projectId}`)
      .set(auth)
      .send({ status: "COMPLETED" });
    expect(completed.status).toBe(200);
    expect(completed.body.data.status).toBe("COMPLETED");
  });

  it("defaults personal workspaces to private visibility", async () => {
    const personal = await registerLoginAndCreateWorkspace({
      name: "Personal Project Default",
      type: "PERSONAL",
    });
    const response = await request(personal.app)
      .post(`/api/v1/workspaces/${personal.workspaceId}/projects`)
      .set("Authorization", `Bearer ${personal.accessToken}`)
      .send({ name: "Personal project" });
    expect(response.status).toBe(201);
    expect(response.body.data.visibility).toBe("PRIVATE");
  });
});

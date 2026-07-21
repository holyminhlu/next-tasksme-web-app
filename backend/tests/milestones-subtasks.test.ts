import request from "supertest";
import { describe, expect, it } from "vitest";
import { registerLoginAndCreateWorkspace } from "./helpers.js";

describe("milestones and task hierarchy", () => {
  async function setup(name: string) {
    const owner = await registerLoginAndCreateWorkspace({ name });
    const workspaceId = owner.workspaceId as string;
    const auth = { Authorization: `Bearer ${owner.accessToken}` };
    const projectsBase = `/api/v1/workspaces/${workspaceId}/projects`;
    const tasksBase = `/api/v1/workspaces/${workspaceId}/tasks`;
    const project = await request(owner.app)
      .post(projectsBase)
      .set(auth)
      .send({ name: `${name} project`, status: "ACTIVE" });
    expect(project.status).toBe(201);
    return {
      owner,
      workspaceId,
      auth,
      projectsBase,
      tasksBase,
      projectId: project.body.data.id as string,
    };
  }

  it("supports milestone CRUD, reorder, dates, and completion timestamps", async () => {
    const { owner, auth, projectsBase, projectId } = await setup("Milestones");
    const base = `${projectsBase}/${projectId}/milestones`;

    const invalid = await request(owner.app)
      .post(base)
      .set(auth)
      .send({
        name: "Invalid",
        startAt: "2026-08-02T00:00:00.000Z",
        dueAt: "2026-08-01T00:00:00.000Z",
      });
    expect(invalid.status).toBe(400);

    const first = await request(owner.app)
      .post(base)
      .set(auth)
      .send({ name: "First milestone" });
    const second = await request(owner.app)
      .post(base)
      .set(auth)
      .send({ name: "Second milestone", status: "COMPLETED" });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.completedAt).toBeTruthy();

    const firstId = first.body.data.id as string;
    const secondId = second.body.data.id as string;
    const reordered = await request(owner.app)
      .put(`${base}/reorder`)
      .set(auth)
      .send({ milestoneIds: [secondId, firstId] });
    expect(reordered.status).toBe(200);
    expect(reordered.body.data.map((item: { id: string }) => item.id)).toEqual([
      secondId,
      firstId,
    ]);

    const reopened = await request(owner.app)
      .patch(`${base}/${secondId}`)
      .set(auth)
      .send({ status: "IN_PROGRESS" });
    expect(reopened.status).toBe(200);
    expect(reopened.body.data.completedAt).toBeNull();

    const removed = await request(owner.app)
      .delete(`${base}/${firstId}`)
      .set(auth);
    expect(removed.status).toBe(200);
    expect(
      await request(owner.app).get(`${base}/${firstId}`).set(auth),
    ).toMatchObject({ status: 404 });
  });

  it("validates parent depth, cycles, milestone scope, and project reassignment", async () => {
    const { owner, auth, projectsBase, tasksBase, projectId } =
      await setup("Hierarchy");
    const milestone = await request(owner.app)
      .post(`${projectsBase}/${projectId}/milestones`)
      .set(auth)
      .send({ name: "Delivery" });
    const milestoneId = milestone.body.data.id as string;

    const root = await request(owner.app)
      .post(tasksBase)
      .set(auth)
      .send({ title: "Root", projectId, milestoneId });
    expect(root.status).toBe(201);
    expect(root.body.data.milestone.id).toBe(milestoneId);

    let parentId = root.body.data.id as string;
    const chain = [root.body.data];
    for (let level = 2; level <= 5; level += 1) {
      const child = await request(owner.app)
        .post(tasksBase)
        .set(auth)
        .send({ title: `Level ${level}`, projectId, parentTaskId: parentId });
      expect(child.status).toBe(201);
      expect(child.body.data.parentTaskId).toBe(parentId);
      chain.push(child.body.data);
      parentId = child.body.data.id as string;
    }

    const tooDeep = await request(owner.app)
      .post(tasksBase)
      .set(auth)
      .send({ title: "Level 6", projectId, parentTaskId: parentId });
    expect(tooDeep.status).toBe(400);

    const cycle = await request(owner.app)
      .patch(`${tasksBase}/${root.body.data.id}`)
      .set(auth)
      .send({ version: root.body.data.version, parentTaskId: parentId });
    expect(cycle.status).toBe(400);

    const otherProject = await request(owner.app)
      .post(projectsBase)
      .set(auth)
      .send({ name: "Other project", status: "ACTIVE" });
    const moved = await request(owner.app)
      .patch(`${tasksBase}/${chain[1].id}`)
      .set(auth)
      .send({
        version: chain[1].version,
        projectId: otherProject.body.data.id,
      });
    expect(moved.status).toBe(200);
    expect(moved.body.data.parentTaskId).toBeNull();
    expect(moved.body.data.milestoneId).toBeNull();

    const incompatibleMilestone = await request(owner.app)
      .patch(`${tasksBase}/${moved.body.data.id}`)
      .set(auth)
      .send({
        version: moved.body.data.version,
        milestoneId,
      });
    expect(incompatibleMilestone.status).toBe(400);
  });
});

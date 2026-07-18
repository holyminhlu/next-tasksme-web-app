import request from "supertest";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/config/database.js";
import { registerLoginAndCreateWorkspace } from "./helpers.js";

describe("phase 7.2 dependencies, handoff, and time tracking", () => {
  async function setup(name: string) {
    const owner = await registerLoginAndCreateWorkspace({ name });
    const tasksBase = `/api/v1/workspaces/${owner.workspaceId}/tasks`;
    const createTask = async (title: string) => {
      const response = await request(owner.app)
        .post(tasksBase)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ title });
      expect(response.status).toBe(201);
      return response.body.data as {
        id: string;
        taskNumber: number;
        status: string;
        version: number;
      };
    };
    return { owner, tasksBase, createTask };
  }

  it("rejects self, duplicate, and cyclic dependencies", async () => {
    const { owner, tasksBase, createTask } = await setup("Dependency Rules");
    const [a, b, c] = await Promise.all([
      createTask("A"),
      createTask("B"),
      createTask("C"),
    ]);
    const auth = { Authorization: `Bearer ${owner.accessToken}` };

    const self = await request(owner.app)
      .post(`${tasksBase}/${a.id}/dependencies`)
      .set(auth)
      .send({ relatedTaskId: a.id, direction: "BLOCKING" });
    expect(self.status).toBe(400);

    const aToB = await request(owner.app)
      .post(`${tasksBase}/${a.id}/dependencies`)
      .set(auth)
      .send({ relatedTaskId: b.id, direction: "BLOCKING" });
    expect(aToB.status).toBe(201);

    const duplicate = await request(owner.app)
      .post(`${tasksBase}/${a.id}/dependencies`)
      .set(auth)
      .send({ relatedTaskId: b.id, direction: "BLOCKING" });
    expect(duplicate.status).toBe(409);

    const bToC = await request(owner.app)
      .post(`${tasksBase}/${b.id}/dependencies`)
      .set(auth)
      .send({ relatedTaskId: c.id, direction: "BLOCKING" });
    expect(bToC.status).toBe(201);

    const cycle = await request(owner.app)
      .post(`${tasksBase}/${c.id}/dependencies`)
      .set(auth)
      .send({ relatedTaskId: a.id, direction: "BLOCKING" });
    expect(cycle.status).toBe(409);

    const outsider = await registerLoginAndCreateWorkspace({
      name: "Dependency Outsider",
    });
    await request(outsider.app)
      .get(`${tasksBase}/${a.id}/dependencies`)
      .set("Authorization", `Bearer ${outsider.accessToken}`)
      .expect(403);
  });

  it("enforces completion policy and records authorized overrides", async () => {
    const { owner, tasksBase, createTask } = await setup("Completion Policy");
    const [predecessor, successor, warnSuccessor] = await Promise.all([
      createTask("Predecessor"),
      createTask("Successor"),
      createTask("Warn-only successor"),
    ]);
    const auth = { Authorization: `Bearer ${owner.accessToken}` };
    await request(owner.app)
      .post(`${tasksBase}/${predecessor.id}/dependencies`)
      .set(auth)
      .send({ relatedTaskId: successor.id, direction: "BLOCKING" });
    await request(owner.app)
      .post(`${tasksBase}/${predecessor.id}/dependencies`)
      .set(auth)
      .send({ relatedTaskId: warnSuccessor.id, direction: "BLOCKING" })
      .expect(201);

    const warnBlockedTask = await request(owner.app)
      .get(`${tasksBase}/${warnSuccessor.id}`)
      .set(auth);
    const warnedCompletion = await request(owner.app)
      .patch(`${tasksBase}/${warnSuccessor.id}/status`)
      .set(auth)
      .send({
        status: "DONE",
        version: warnBlockedTask.body.data.version,
      });
    expect(warnedCompletion.status).toBe(200);
    expect(warnedCompletion.body.data.dependencyOverrideReason).toBeNull();

    const blockedTask = await request(owner.app)
      .get(`${tasksBase}/${successor.id}`)
      .set(auth);
    expect(blockedTask.body.data.status).toBe("BLOCKED");

    await request(owner.app)
      .patch(`/api/v1/workspaces/${owner.workspaceId}`)
      .set(auth)
      .send({ dependencyCompletionPolicy: "BLOCK" })
      .expect(200);

    await request(owner.app)
      .patch(`${tasksBase}/${successor.id}/status`)
      .set(auth)
      .send({ status: "DONE", version: blockedTask.body.data.version })
      .expect(409);

    await request(owner.app)
      .patch(`/api/v1/workspaces/${owner.workspaceId}`)
      .set(auth)
      .send({ dependencyCompletionPolicy: "BLOCK_WITH_OVERRIDE" })
      .expect(200);

    await request(owner.app)
      .patch(`${tasksBase}/${successor.id}/status`)
      .set(auth)
      .send({ status: "DONE", version: blockedTask.body.data.version })
      .expect(400);

    const overridden = await request(owner.app)
      .patch(`${tasksBase}/${successor.id}/status`)
      .set(auth)
      .send({
        status: "DONE",
        version: blockedTask.body.data.version,
        dependencyOverrideReason: "Emergency customer handoff",
      });
    expect(overridden.status).toBe(200);
    expect(overridden.body.data.dependencyOverrideReason).toBe(
      "Emergency customer handoff",
    );
    expect(overridden.body.data.dependencyOverriddenById).toBe(owner.userId);
    expect(
      await prisma.auditLog.count({
        where: {
          action: "task.dependency_completion_overridden",
          entityId: successor.id,
        },
      }),
    ).toBe(1);
  });

  it("unblocks handoff only after all predecessors finish and notifies once", async () => {
    const { owner, tasksBase, createTask } = await setup("Handoff");
    const [a, b, successor] = await Promise.all([
      createTask("A"),
      createTask("B"),
      createTask("Ready after both"),
    ]);
    const auth = { Authorization: `Bearer ${owner.accessToken}` };
    for (const predecessor of [a, b]) {
      const response = await request(owner.app)
        .post(`${tasksBase}/${predecessor.id}/dependencies`)
        .set(auth)
        .send({ relatedTaskId: successor.id, direction: "BLOCKING" });
      expect(response.status).toBe(201);
    }

    const complete = async (task: typeof a) =>
      request(owner.app)
        .patch(`${tasksBase}/${task.id}/status`)
        .set(auth)
        .send({ status: "DONE", version: task.version });

    expect((await complete(a)).status).toBe(200);
    const stillBlocked = await request(owner.app)
      .get(`${tasksBase}/${successor.id}`)
      .set(auth);
    expect(stillBlocked.body.data.status).toBe("BLOCKED");

    expect((await complete(b)).status).toBe(200);
    const ready = await request(owner.app)
      .get(`${tasksBase}/${successor.id}`)
      .set(auth);
    expect(ready.body.data.status).toBe("TODO");
    expect(ready.body.data.status).not.toBe("IN_PROGRESS");
    expect(
      await prisma.notification.count({
        where: {
          taskId: successor.id,
          type: "TASK_UNBLOCKED",
        },
      }),
    ).toBe(1);

    const latestB = await request(owner.app)
      .get(`${tasksBase}/${b.id}`)
      .set(auth);
    const reopenedB = await request(owner.app)
      .patch(`${tasksBase}/${b.id}/status`)
      .set(auth)
      .send({ status: "IN_PROGRESS", version: latestB.body.data.version });
    expect(reopenedB.status).toBe(200);
    const completedAgain = await request(owner.app)
      .patch(`${tasksBase}/${b.id}/status`)
      .set(auth)
      .send({ status: "DONE", version: reopenedB.body.data.version });
    expect(completedAgain.status).toBe(200);
    expect(
      await prisma.notification.count({
        where: {
          taskId: successor.id,
          type: "TASK_UNBLOCKED",
        },
      }),
    ).toBe(1);
  });

  it("persists one server timer per user/workspace and blocks overlapping logs", async () => {
    const { owner, tasksBase, createTask } = await setup("Time Tracking");
    const [a, b] = await Promise.all([createTask("Timed A"), createTask("Timed B")]);
    const auth = { Authorization: `Bearer ${owner.accessToken}` };

    const started = await request(owner.app)
      .post(`${tasksBase}/${a.id}/time-logs/timer/start`)
      .set(auth)
      .send({});
    expect(started.status).toBe(201);
    expect(started.body.data.endedAt).toBeNull();

    const running = await request(owner.app)
      .get(`/api/v1/workspaces/${owner.workspaceId}/timers/running`)
      .set(auth);
    expect(running.status).toBe(200);
    expect(running.body.data.id).toBe(started.body.data.id);

    await request(owner.app)
      .post(`${tasksBase}/${b.id}/time-logs/timer/start`)
      .set(auth)
      .send({})
      .expect(409);

    const stopped = await request(owner.app)
      .post(`${tasksBase}/${a.id}/time-logs/timer/stop`)
      .set(auth)
      .send({});
    expect(stopped.status).toBe(200);
    expect(stopped.body.data.durationSeconds).toBeGreaterThanOrEqual(0);

    await request(owner.app)
      .post(`${tasksBase}/${a.id}/time-logs`)
      .set(auth)
      .send({
        startedAt: "2026-07-18T08:00:00.000Z",
        endedAt: "2026-07-18T09:00:00.000Z",
        description: "Manual work",
      })
      .expect(201);
    await request(owner.app)
      .post(`${tasksBase}/${b.id}/time-logs`)
      .set(auth)
      .send({
        startedAt: "2026-07-18T08:30:00.000Z",
        endedAt: "2026-07-18T09:30:00.000Z",
      })
      .expect(409);
  });

  it("records every service status transition and aggregates stage durations", async () => {
    const { owner, tasksBase, createTask } = await setup("Stage History");
    const task = await createTask("History");
    const auth = { Authorization: `Bearer ${owner.accessToken}` };
    const inProgress = await request(owner.app)
      .patch(`${tasksBase}/${task.id}/status`)
      .set(auth)
      .send({ status: "IN_PROGRESS", version: task.version });
    expect(inProgress.status).toBe(200);
    const done = await request(owner.app)
      .patch(`${tasksBase}/${task.id}/status`)
      .set(auth)
      .send({ status: "DONE", version: inProgress.body.data.version });
    expect(done.status).toBe(200);

    const history = await request(owner.app)
      .get(`${tasksBase}/${task.id}/status-history`)
      .set(auth);
    expect(history.status).toBe(200);
    expect(
      history.body.data.items.map(
        (item: { fromStatus: string | null; toStatus: string }) => [
          item.fromStatus,
          item.toStatus,
        ],
      ),
    ).toEqual([
      [null, "TODO"],
      ["TODO", "IN_PROGRESS"],
      ["IN_PROGRESS", "DONE"],
    ]);
    expect(history.body.data.durationByStatus).toHaveProperty("TODO");
    expect(history.body.data.cycleTimeSeconds).toBeGreaterThanOrEqual(0);
  });
});

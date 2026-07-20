import request from "supertest";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/config/database.js";
import { computeNextRunAt } from "../src/lib/recurrence-schedule.js";
import { calculateTaskRisk } from "../src/lib/risk-calculator.js";
import { generateDueOccurrences } from "../src/modules/recurrences/recurrences.service.js";
import { processDueSlaNotifications } from "../src/modules/sla/sla.service.js";
import { registerLoginAndCreateWorkspace } from "./helpers.js";

describe("phase 7.3 recurring tasks, risk, and SLA", () => {
  async function setup(name: string) {
    const owner = await registerLoginAndCreateWorkspace({ name });
    expect(owner.workspaceId).toBeTruthy();
    const workspaceId = owner.workspaceId as string;
    const userId = owner.userId as string;
    const tasksBase = `/api/v1/workspaces/${workspaceId}/tasks`;
    const createTask = async (title: string, extra: Record<string, unknown> = {}) => {
      const response = await request(owner.app)
        .post(tasksBase)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ title, ...extra });
      expect(response.status).toBe(201);
      return response.body.data as {
        id: string;
        version: number;
        status: string;
      };
    };
    return { owner, workspaceId, userId, tasksBase, createTask };
  }

  it("supports daily/weekly recurrence with pause, resume, and next-run preview", async () => {
    const { owner, tasksBase, createTask } = await setup("Recurrence Schedule");
    const task = await createTask("Weekly checklist");
    const auth = { Authorization: `Bearer ${owner.accessToken}` };
    const startAt = new Date(Date.now() + 60_000).toISOString();

    const preview = await request(owner.app)
      .post(`${tasksBase}/${task.id}/recurrence/preview`)
      .set(auth)
      .send({
        frequency: "WEEKLY",
        interval: 1,
        daysOfWeek: [1, 3],
        timezone: "UTC",
        startAt,
        overlapPolicy: "SKIP_IF_OPEN",
        count: 3,
      });
    expect(preview.status).toBe(200);
    expect(preview.body.data.nextRuns.length).toBeGreaterThan(0);

    const created = await request(owner.app)
      .put(`${tasksBase}/${task.id}/recurrence`)
      .set(auth)
      .send({
        frequency: "DAILY",
        interval: 1,
        timezone: "UTC",
        startAt,
        overlapPolicy: "CREATE_ANYWAY",
      });
    expect(created.status).toBe(201);
    expect(created.body.data.isActive).toBe(true);
    expect(created.body.data.nextRunAt).toBeTruthy();

    const paused = await request(owner.app)
      .post(`${tasksBase}/${task.id}/recurrence/pause`)
      .set(auth)
      .send({});
    expect(paused.status).toBe(200);
    expect(paused.body.data.isActive).toBe(false);
    expect(paused.body.data.nextRunAt).toBeNull();

    const resumed = await request(owner.app)
      .post(`${tasksBase}/${task.id}/recurrence/resume`)
      .set(auth)
      .send({});
    expect(resumed.status).toBe(200);
    expect(resumed.body.data.isActive).toBe(true);
    expect(resumed.body.data.nextRunAt).toBeTruthy();
  });

  it("applies SKIP_IF_OPEN and unique occurrence constraint", async () => {
    const { owner, workspaceId, userId, createTask } = await setup("Overlap Policy");
    const template = await createTask("Open template");
    const now = new Date();
    const scheduledAt = new Date(now.getTime() - 60_000);
    const recurrence = await prisma.taskRecurrence.create({
      data: {
        workspaceId,
        templateTaskId: template.id,
        frequency: "DAILY",
        interval: 1,
        daysOfWeekJson: [],
        timezone: "UTC",
        startAt: scheduledAt,
        nextRunAt: scheduledAt,
        overlapPolicy: "SKIP_IF_OPEN",
        isActive: true,
        createdById: userId,
      },
    });

    const first = await generateDueOccurrences(recurrence.id, now);
    expect(first?.status).toBe("CREATED");

    await prisma.taskRecurrence.update({
      where: { id: recurrence.id },
      data: { nextRunAt: new Date(now.getTime() - 30_000) },
    });
    const second = await generateDueOccurrences(recurrence.id, now);
    expect(second?.status).toBe("SKIPPED");

    const duplicateAttempt = await prisma.recurringTaskOccurrence.create({
      data: {
        recurrenceId: recurrence.id,
        scheduledAt: first!.scheduledAt,
        status: "PENDING",
      },
    }).catch((error: { code?: string }) => error);
    expect((duplicateAttempt as { code?: string }).code).toBe("P2002");
  });

  it("returns explainable risk reasons and stays workspace scoped", async () => {
    const { owner, tasksBase, createTask } = await setup("Risk Reasons");
    const overdue = await createTask("Overdue unassigned", {
      dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    });
    await prisma.task.update({
      where: { id: overdue.id },
      data: { assigneeId: null, riskRecalculateAt: new Date() },
    });
    const auth = { Authorization: `Bearer ${owner.accessToken}` };

    const risk = await request(owner.app)
      .get(`${tasksBase}/${overdue.id}/risk`)
      .set(auth);
    expect(risk.status).toBe(200);
    expect(risk.body.data.riskScore).toBeGreaterThan(0);
    expect(risk.body.data.riskReasons.length).toBeGreaterThan(0);
    expect(
      risk.body.data.riskReasons.some((reason: string) =>
        /overdue/i.test(reason),
      ),
    ).toBe(true);

    const calculated = calculateTaskRisk({
      dueDate: new Date(Date.now() - 86_400_000),
      assigneeId: null,
      status: "TODO",
    });
    expect(calculated.reasons.length).toBeGreaterThan(0);
    expect(calculated.level).not.toBe("LOW");

    const outsider = await registerLoginAndCreateWorkspace({ name: "Risk Outsider" });
    await request(outsider.app)
      .get(`${tasksBase}/${overdue.id}/risk`)
      .set("Authorization", `Bearer ${outsider.accessToken}`)
      .expect(403);
  });

  it("gates SLA behind module enablement and does not force Personal SLA", async () => {
    const { owner, workspaceId, tasksBase, createTask } = await setup("SLA Gate");
    const auth = { Authorization: `Bearer ${owner.accessToken}` };
    const task = await createTask("SLA candidate", { priority: "URGENT" });

    const disabled = await request(owner.app)
      .get(`/api/v1/workspaces/${workspaceId}/sla-policies`)
      .set(auth);
    expect(disabled.status).toBe(403);

    await request(owner.app)
      .patch(`/api/v1/workspaces/${workspaceId}/modules`)
      .set(auth)
      .send({ modules: [{ moduleKey: "sla", enabled: true }] })
      .expect(200);

    const calendar = await request(owner.app)
      .post(`/api/v1/workspaces/${workspaceId}/business-calendars`)
      .set(auth)
      .send({
        name: "Office hours",
        timezone: "UTC",
        isDefault: true,
        workingHours: [
          { dayOfWeek: 1, startMinute: 0, endMinute: 1440 },
          { dayOfWeek: 2, startMinute: 0, endMinute: 1440 },
          { dayOfWeek: 3, startMinute: 0, endMinute: 1440 },
          { dayOfWeek: 4, startMinute: 0, endMinute: 1440 },
          { dayOfWeek: 5, startMinute: 0, endMinute: 1440 },
        ],
      });
    expect(calendar.status).toBe(201);

    const policy = await request(owner.app)
      .post(`/api/v1/workspaces/${workspaceId}/sla-policies`)
      .set(auth)
      .send({
        name: "Urgent 2h",
        targetDurationMinutes: 120,
        warningBeforeMinutes: 30,
        businessCalendarId: calendar.body.data.id,
        applicableConditions: { priorities: ["URGENT"] },
      });
    expect(policy.status).toBe(201);

    const instance = await prisma.taskSlaInstance.create({
      data: {
        workspaceId,
        taskId: task.id,
        policyId: policy.body.data.id,
        startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        dueAt: new Date(Date.now() - 60_000),
        warningAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        status: "ACTIVE",
      },
    });

    await processDueSlaNotifications(10, new Date());
    await processDueSlaNotifications(10, new Date());

    const refreshed = await prisma.taskSlaInstance.findUniqueOrThrow({
      where: { id: instance.id },
    });
    expect(refreshed.warningSentAt).not.toBeNull();
    expect(refreshed.breachNotifiedAt).not.toBeNull();
    expect(refreshed.status).toBe("BREACHED");

    const warnings = await prisma.notification.count({
      where: {
        workspaceId,
        taskId: task.id,
        type: "SLA_WARNING",
      },
    });
    const breaches = await prisma.notification.count({
      where: {
        workspaceId,
        taskId: task.id,
        type: "SLA_BREACHED",
      },
    });
    expect(warnings).toBe(1);
    expect(breaches).toBe(1);

    const personal = await registerLoginAndCreateWorkspace({
      name: "Personal SLA",
      type: "PERSONAL",
    });
    const personalModules = await request(personal.app)
      .get(`/api/v1/workspaces/${personal.workspaceId}/modules`)
      .set("Authorization", `Bearer ${personal.accessToken}`);
    expect(personalModules.status).toBe(200);
    const modules = Array.isArray(personalModules.body.data)
      ? personalModules.body.data
      : personalModules.body.data?.items ?? [];
    const slaModule = modules.find(
      (module: { moduleKey: string; enabled: boolean }) => module.moduleKey === "sla",
    );
    expect(slaModule?.enabled ?? false).toBe(false);

    const nextMonthly = computeNextRunAt(
      {
        frequency: "MONTHLY",
        interval: 1,
        dayOfMonth: 31,
        timezone: "UTC",
        startAt: "2026-01-31T10:00:00.000Z",
      },
      "2026-01-31T10:00:00.000Z",
    );
    expect(nextMonthly).not.toBeNull();
    expect(nextMonthly!.toISOString()).toContain("2026-02-28");
  });
});

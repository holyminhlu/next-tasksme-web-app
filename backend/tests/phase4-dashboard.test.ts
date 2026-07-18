import request from "supertest";
import { describe, expect, it } from "vitest";
import type { Express } from "express";
import { prisma } from "../src/config/database.js";
import { hashToken } from "../src/lib/tokens.js";
import {
  endOfDayUtc,
  startOfDayUtc,
  todayYmd,
  addCalendarDays,
  zonedDateTimeToUtc,
} from "../src/lib/timezone.js";
import {
  registerAndLogin,
  registerLoginAndCreateWorkspace,
} from "./helpers.js";

async function inviteAndAcceptMember(options: {
  app: Express;
  ownerToken: string;
  workspaceId: string;
  email: string;
  roleKey?: "member" | "manager" | "admin";
  fullName?: string;
}) {
  const roleKey = options.roleKey ?? "member";
  const invite = await request(options.app)
    .post(`/api/v1/workspaces/${options.workspaceId}/invitations`)
    .set("Authorization", `Bearer ${options.ownerToken}`)
    .send({ email: options.email, roleKey });
  expect(invite.status).toBe(201);

  const invitation = await prisma.workspaceInvitation.findFirst({
    where: {
      workspaceId: options.workspaceId,
      email: options.email,
      status: "PENDING",
    },
  });
  expect(invitation).toBeTruthy();

  const raw = `invite-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await prisma.workspaceInvitation.update({
    where: { id: invitation!.id },
    data: { tokenHash: hashToken(raw) },
  });

  const accept = await request(options.app)
    .post("/api/v1/invitations/accept")
    .send({
      token: raw,
      fullName: options.fullName ?? "Invited Member",
      password: "Password123",
      confirmPassword: "Password123",
    });
  expect(accept.status).toBe(200);

  const login = await request(options.app).post("/api/v1/auth/login").send({
    email: options.email,
    password: "Password123",
  });
  expect(login.status).toBe(200);

  return {
    userId: accept.body.data.userId as string,
    accessToken: login.body.data.accessToken as string,
  };
}

describe("phase 4 dashboard, tasks, parse, activity", () => {
  it("isolates tasks and dashboard across workspaces", async () => {
    const a = await registerLoginAndCreateWorkspace({
      email: `owner-a-${Date.now()}@example.com`,
      name: `WS A ${Date.now()}`,
    });
    const sessionB = await registerAndLogin(
      { email: `owner-b2-${Date.now()}@example.com` },
      a.app,
    );
    const wsB = await request(a.app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${sessionB.accessToken}`)
      .send({ type: "ORGANIZATION", name: `WS B ${Date.now()}` });
    expect(wsB.status).toBe(201);
    const workspaceBId = wsB.body.data.id as string;

    const created = await request(a.app)
      .post(`/api/v1/workspaces/${a.workspaceId}/tasks`)
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ title: "Secret A task" });
    expect(created.status).toBe(201);

    const crossList = await request(a.app)
      .get(`/api/v1/workspaces/${a.workspaceId}/tasks`)
      .set("Authorization", `Bearer ${sessionB.accessToken}`);
    expect(crossList.status).toBe(403);

    const crossDash = await request(a.app)
      .get(`/api/v1/workspaces/${a.workspaceId}/dashboard/summary`)
      .set("Authorization", `Bearer ${sessionB.accessToken}`);
    expect(crossDash.status).toBe(403);

    const ownList = await request(a.app)
      .get(`/api/v1/workspaces/${workspaceBId}/tasks`)
      .set("Authorization", `Bearer ${sessionB.accessToken}`);
    expect(ownList.status).toBe(200);
    expect(ownList.body.data).toEqual([]);
  });

  it("applies metric definitions for timezone, no-deadline, and cancelled", async () => {
    const tz = "Asia/Ho_Chi_Minh";
    const owner = await registerLoginAndCreateWorkspace({
      timezone: tz,
      locale: "vi",
    });
    const today = todayYmd(tz);
    const [ty, tm, td] = today.split("-").map(Number);
    const yestUtc = new Date(Date.UTC(ty!, tm! - 1, td! - 1));
    const yesterday = zonedDateTimeToUtc(
      yestUtc.getUTCFullYear(),
      yestUtc.getUTCMonth() + 1,
      yestUtc.getUTCDate(),
      10,
      0,
      0,
      tz,
    );

    const todayDue = zonedDateTimeToUtc(
      Number(today.slice(0, 4)),
      Number(today.slice(5, 7)),
      Number(today.slice(8, 10)),
      15,
      0,
      0,
      tz,
    );

    await prisma.task.createMany({
      data: [
        {
          workspaceId: owner.workspaceId!,
          title: "Due today open",
          status: "TODO",
          dueDate: todayDue,
          createdById: owner.userId!,
          assigneeId: owner.userId!,
        },
        {
          workspaceId: owner.workspaceId!,
          title: "Overdue open",
          status: "IN_PROGRESS",
          dueDate: yesterday,
          createdById: owner.userId!,
          assigneeId: owner.userId!,
        },
        {
          workspaceId: owner.workspaceId!,
          title: "No deadline",
          status: "TODO",
          dueDate: null,
          createdById: owner.userId!,
          assigneeId: owner.userId!,
        },
        {
          workspaceId: owner.workspaceId!,
          title: "Cancelled past due",
          status: "CANCELLED",
          dueDate: yesterday,
          createdById: owner.userId!,
          assigneeId: owner.userId!,
        },
        {
          workspaceId: owner.workspaceId!,
          title: "Done recently",
          status: "DONE",
          dueDate: todayDue,
          createdById: owner.userId!,
          assigneeId: owner.userId!,
          completedAt: new Date(),
        },
        {
          workspaceId: owner.workspaceId!,
          title: "Blocked open",
          status: "TODO",
          isBlocked: true,
          blockedReason: "waiting",
          createdById: owner.userId!,
          assigneeId: null,
        },
      ],
    });

    const summary = await request(owner.app)
      .get(`/api/v1/workspaces/${owner.workspaceId}/dashboard/summary`)
      .query({ timezone: tz, from: today, to: today })
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(summary.status).toBe(200);
    expect(summary.body.meta.generatedAt).toBeTruthy();
    expect(summary.body.data.scope.workspaceScope).toBe(true);
    expect(summary.body.data.stats.openTasks).toBe(4);
    expect(summary.body.data.stats.dueToday).toBe(1);
    expect(summary.body.data.stats.overdue).toBe(1);
    expect(summary.body.data.stats.completed).toBe(1);
    expect(summary.body.data.stats.unassignedTasks).toBe(1);
    expect(summary.body.data.stats.blockedTasks).toBe(1);

    const myToday = await request(owner.app)
      .get(`/api/v1/workspaces/${owner.workspaceId}/dashboard/my-work`)
      .query({ tab: "today", timezone: tz, limit: 50 })
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(myToday.status).toBe(200);
    expect(myToday.body.data.total).toBe(summary.body.data.stats.dueToday);

    const listed = await prisma.task.findFirst({
      where: { workspaceId: owner.workspaceId!, title: "Due today open" },
    });
    await prisma.task.update({
      where: { id: listed!.id },
      data: { deletedAt: new Date() },
    });
    const afterDelete = await request(owner.app)
      .get(`/api/v1/workspaces/${owner.workspaceId}/dashboard/summary`)
      .query({ timezone: tz })
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(afterDelete.body.data.stats.dueToday).toBe(0);
  });

  it("scopes member list/dashboard to assignee or creator and rejects memberId filter", async () => {
    const owner = await registerLoginAndCreateWorkspace({
      type: "ORGANIZATION",
    });
    const member = await inviteAndAcceptMember({
      app: owner.app,
      ownerToken: owner.accessToken!,
      workspaceId: owner.workspaceId!,
      email: `member-${Date.now()}@example.com`,
      fullName: "Member One",
    });

    const other = await inviteAndAcceptMember({
      app: owner.app,
      ownerToken: owner.accessToken!,
      workspaceId: owner.workspaceId!,
      email: `other-${Date.now()}@example.com`,
      fullName: "Other Member",
    });

    await prisma.task.createMany({
      data: [
        {
          workspaceId: owner.workspaceId!,
          title: "Owner only",
          createdById: owner.userId!,
          assigneeId: owner.userId!,
          status: "TODO",
        },
        {
          workspaceId: owner.workspaceId!,
          title: "Assigned to member",
          createdById: owner.userId!,
          assigneeId: member.userId,
          status: "TODO",
        },
        {
          workspaceId: owner.workspaceId!,
          title: "Created by member",
          createdById: member.userId,
          assigneeId: other.userId,
          status: "IN_PROGRESS",
        },
        {
          workspaceId: owner.workspaceId!,
          title: "Other private",
          createdById: other.userId,
          assigneeId: other.userId,
          status: "TODO",
        },
      ],
    });

    const list = await request(owner.app)
      .get(`/api/v1/workspaces/${owner.workspaceId}/tasks`)
      .set("Authorization", `Bearer ${member.accessToken}`);
    expect(list.status).toBe(200);
    const titles = list.body.data.map((t: { title: string }) => t.title).sort();
    expect(titles).toEqual(["Assigned to member", "Created by member"]);

    const summary = await request(owner.app)
      .get(`/api/v1/workspaces/${owner.workspaceId}/dashboard/summary`)
      .set("Authorization", `Bearer ${member.accessToken}`);
    expect(summary.status).toBe(200);
    expect(summary.body.data.scope.workspaceScope).toBe(false);
    expect(summary.body.data.stats.unassignedTasks).toBeUndefined();
    expect(summary.body.data.stats.blockedTasks).toBeUndefined();
    expect(summary.body.data.stats.openTasks).toBe(2);

    const rejectFilter = await request(owner.app)
      .get(`/api/v1/workspaces/${owner.workspaceId}/dashboard/summary`)
      .query({ memberId: other.userId })
      .set("Authorization", `Bearer ${member.accessToken}`);
    expect(rejectFilter.status).toBe(403);

    const charts = await request(owner.app)
      .get(`/api/v1/workspaces/${owner.workspaceId}/dashboard/charts`)
      .set("Authorization", `Bearer ${member.accessToken}`);
    expect(charts.status).toBe(200);
    expect(charts.body.data.available).toBe(false);
    expect(charts.body.data.teamWorkload).toBeUndefined();

    const ownerCharts = await request(owner.app)
      .get(`/api/v1/workspaces/${owner.workspaceId}/dashboard/charts`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(ownerCharts.status).toBe(200);
    expect(ownerCharts.body.data.available).toBe(true);
    expect(ownerCharts.body.data.teamWorkload).toBeTruthy();
  });

  it("parses without creating and isolates project/assignee candidates to workspace", async () => {
    const a = await registerLoginAndCreateWorkspace({
      name: `Parse A ${Date.now()}`,
      timezone: "Asia/Ho_Chi_Minh",
    });
    const bSession = await registerAndLogin(
      { email: `parse-b-${Date.now()}@example.com` },
      a.app,
    );
    const bWs = await request(a.app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${bSession.accessToken}`)
      .send({ type: "ORGANIZATION", name: `Parse B ${Date.now()}` });
    const workspaceBId = bWs.body.data.id as string;

    await prisma.project.create({
      data: {
        workspaceId: a.workspaceId!,
        name: "Marketing",
        createdById: a.userId!,
      },
    });
    await prisma.project.create({
      data: {
        workspaceId: workspaceBId,
        name: "Marketing",
        createdById: bSession.userId!,
      },
    });

    const beforeCount = await prisma.task.count();

    const parsed = await request(a.app)
      .post(`/api/v1/workspaces/${a.workspaceId}/tasks/parse`)
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({
        text: "Urgent review deck tomorrow #Marketing @Test",
        locale: "en",
        timezone: "Asia/Ho_Chi_Minh",
        referenceDate: todayYmd("Asia/Ho_Chi_Minh"),
      });

    expect(parsed.status).toBe(200);
    expect(parsed.body.data.draft.title).toBeTruthy();
    expect(parsed.body.data.draft.priority).toBe("URGENT");
    expect(parsed.body.data.draft.dueDate).toBeTruthy();
    expect(
      parsed.body.data.projectCandidates.every(
        (p: { name: string }) => p.name === "Marketing",
      ),
    ).toBe(true);
    const projectIds = parsed.body.data.projectCandidates.map(
      (p: { id: string }) => p.id,
    );
    const foreign = await prisma.project.findFirst({
      where: { workspaceId: workspaceBId, name: "Marketing" },
    });
    expect(projectIds).not.toContain(foreign!.id);
    expect(await prisma.task.count()).toBe(beforeCount);

    const vi = await request(a.app)
      .post(`/api/v1/workspaces/${a.workspaceId}/tasks/parse`)
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({
        text: "Gửi báo cáo hôm nay",
        locale: "vi",
        timezone: "Asia/Ho_Chi_Minh",
        referenceDate: todayYmd("Asia/Ho_Chi_Minh"),
      });
    expect(vi.status).toBe(200);
    expect(vi.body.data.draft.dueDate).toBeTruthy();
    const due = new Date(vi.body.data.draft.dueDate);
    expect(due.getTime()).toBeGreaterThanOrEqual(
      startOfDayUtc(todayYmd("Asia/Ho_Chi_Minh"), "Asia/Ho_Chi_Minh").getTime(),
    );
    expect(due.getTime()).toBeLessThan(
      endOfDayUtc(todayYmd("Asia/Ho_Chi_Minh"), "Asia/Ho_Chi_Minh").getTime(),
    );
  });

  it("sets AI_QUICK_CAPTURE source only when confirmedFromQuickCapture is true", async () => {
    const owner = await registerLoginAndCreateWorkspace();

    const manual = await request(owner.app)
      .post(`/api/v1/workspaces/${owner.workspaceId}/tasks`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ title: "Manual task", source: "AI_QUICK_CAPTURE" });
    expect(manual.status).toBe(201);
    expect(manual.body.data.source).toBe("MANUAL");

    const ai = await request(owner.app)
      .post(`/api/v1/workspaces/${owner.workspaceId}/tasks`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        title: "From capture",
        confirmedFromQuickCapture: true,
      });
    expect(ai.status).toBe(201);
    expect(ai.body.data.source).toBe("AI_QUICK_CAPTURE");
  });

  it("emits safe activity events and never exposes audit logs on activity feed", async () => {
    const owner = await registerLoginAndCreateWorkspace();
    const member = await inviteAndAcceptMember({
      app: owner.app,
      ownerToken: owner.accessToken!,
      workspaceId: owner.workspaceId!,
      email: `act-member-${Date.now()}@example.com`,
    });

    const project = await request(owner.app)
      .post(`/api/v1/workspaces/${owner.workspaceId}/projects`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Ops" });
    expect(project.status).toBe(201);

    const task = await request(owner.app)
      .post(`/api/v1/workspaces/${owner.workspaceId}/tasks`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        title: "Owner private task",
        projectId: project.body.data.id,
        assigneeId: owner.userId,
      });
    expect(task.status).toBe(201);

    const memberTask = await request(owner.app)
      .post(`/api/v1/workspaces/${owner.workspaceId}/tasks`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .send({ title: "Member task", assigneeId: member.userId });
    expect(memberTask.status).toBe(201);

    await prisma.activityEvent.create({
      data: {
        workspaceId: owner.workspaceId!,
        actorId: owner.userId!,
        action: "secret.reset",
        resourceType: "user",
        resourceId: owner.userId!,
        summary: "Sensitive",
        sensitive: true,
        metadata: { token: "should-not-leak" },
      },
    });

    const ownerFeed = await request(owner.app)
      .get(`/api/v1/workspaces/${owner.workspaceId}/dashboard/activity`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(ownerFeed.status).toBe(200);
    expect(
      ownerFeed.body.data.some(
        (e: { action: string }) => e.action === "secret.reset",
      ),
    ).toBe(false);
    expect(
      ownerFeed.body.data.some((e: { action: string }) =>
        e.action.startsWith("task."),
      ),
    ).toBe(true);

    const memberFeed = await request(owner.app)
      .get(`/api/v1/workspaces/${owner.workspaceId}/dashboard/activity`)
      .set("Authorization", `Bearer ${member.accessToken}`);
    expect(memberFeed.status).toBe(200);
    const actions = memberFeed.body.data.map(
      (e: { summary: string }) => e.summary,
    );
    expect(actions.some((s: string) => s.includes("Member task"))).toBe(true);
    expect(actions.some((s: string) => s.includes("Owner private task"))).toBe(
      false,
    );

    const auditCount = await prisma.auditLog.count({
      where: { workspaceId: owner.workspaceId! },
    });
    expect(auditCount).toBeGreaterThan(0);
    expect(JSON.stringify(memberFeed.body).includes("password")).toBe(false);
  });

  it("validates project and assignee belong to workspace on create/update", async () => {
    const a = await registerLoginAndCreateWorkspace();
    const bSession = await registerAndLogin(
      { email: `val-b-${Date.now()}@example.com` },
      a.app,
    );
    const bWs = await request(a.app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${bSession.accessToken}`)
      .send({ type: "ORGANIZATION", name: `Val B ${Date.now()}` });

    const foreignProject = await prisma.project.create({
      data: {
        workspaceId: bWs.body.data.id,
        name: "Foreign",
        createdById: bSession.userId!,
      },
    });

    const bad = await request(a.app)
      .post(`/api/v1/workspaces/${a.workspaceId}/tasks`)
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ title: "Bad", projectId: foreignProject.id });
    expect(bad.status).toBe(400);

    const badAssignee = await request(a.app)
      .post(`/api/v1/workspaces/${a.workspaceId}/tasks`)
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ title: "Bad", assigneeId: bSession.userId });
    expect(badAssignee.status).toBe(400);
  });

  it("gets task detail with tenant visibility and completedAt lifecycle", async () => {
    const owner = await registerLoginAndCreateWorkspace({
      type: "ORGANIZATION",
    });
    const member = await inviteAndAcceptMember({
      app: owner.app,
      ownerToken: owner.accessToken!,
      workspaceId: owner.workspaceId!,
      email: `detail-member-${Date.now()}@example.com`,
    });

    const created = await request(owner.app)
      .post(`/api/v1/workspaces/${owner.workspaceId}/tasks`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ title: "Owner detail task", status: "DONE" });
    expect(created.status).toBe(201);
    expect(created.body.data.completedAt).toBeTruthy();
    expect(created.body.data.status).toBe("DONE");

    const detail = await request(owner.app)
      .get(
        `/api/v1/workspaces/${owner.workspaceId}/tasks/${created.body.data.id}`,
      )
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.id).toBe(created.body.data.id);
    expect(detail.body.data.completedAt).toBe(created.body.data.completedAt);

    const hidden = await request(owner.app)
      .get(
        `/api/v1/workspaces/${owner.workspaceId}/tasks/${created.body.data.id}`,
      )
      .set("Authorization", `Bearer ${member.accessToken}`);
    expect(hidden.status).toBe(404);

    const reopen = await request(owner.app)
      .patch(
        `/api/v1/workspaces/${owner.workspaceId}/tasks/${created.body.data.id}`,
      )
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ status: "TODO" });
    expect(reopen.status).toBe(200);
    expect(reopen.body.data.status).toBe("TODO");
    expect(reopen.body.data.completedAt).toBeNull();

    const completeAgain = await request(owner.app)
      .patch(
        `/api/v1/workspaces/${owner.workspaceId}/tasks/${created.body.data.id}`,
      )
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ status: "DONE" });
    expect(completeAgain.status).toBe(200);
    expect(completeAgain.body.data.completedAt).toBeTruthy();
  });

  it("soft-deletes tasks, excludes them from lists, and emits task.deleted", async () => {
    const owner = await registerLoginAndCreateWorkspace({
      type: "ORGANIZATION",
    });
    const member = await inviteAndAcceptMember({
      app: owner.app,
      ownerToken: owner.accessToken!,
      workspaceId: owner.workspaceId!,
      email: `del-member-${Date.now()}@example.com`,
    });

    const task = await request(owner.app)
      .post(`/api/v1/workspaces/${owner.workspaceId}/tasks`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ title: "Doomed task", assigneeId: owner.userId });
    expect(task.status).toBe(201);
    const taskId = task.body.data.id as string;

    const forbidden = await request(owner.app)
      .delete(`/api/v1/workspaces/${owner.workspaceId}/tasks/${taskId}`)
      .set("Authorization", `Bearer ${member.accessToken}`);
    expect(forbidden.status).toBe(404);

    const deleted = await request(owner.app)
      .delete(`/api/v1/workspaces/${owner.workspaceId}/tasks/${taskId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(deleted.status).toBe(200);
    expect(deleted.body.data).toMatchObject({
      id: taskId,
      deleted: true,
    });
    expect(deleted.body.data.deletedAt).toBeTruthy();

    const row = await prisma.task.findUnique({ where: { id: taskId } });
    expect(row?.deletedAt).toBeTruthy();

    const listed = await request(owner.app)
      .get(`/api/v1/workspaces/${owner.workspaceId}/tasks`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.find((t: { id: string }) => t.id === taskId)).toBeUndefined();

    const detail = await request(owner.app)
      .get(`/api/v1/workspaces/${owner.workspaceId}/tasks/${taskId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(detail.status).toBe(404);

    const feed = await request(owner.app)
      .get(`/api/v1/workspaces/${owner.workspaceId}/dashboard/activity`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(feed.status).toBe(200);
    const deletedEvent = feed.body.data.find(
      (e: { action: string; resourceId: string }) =>
        e.action === "task.deleted" && e.resourceId === taskId,
    );
    expect(deletedEvent).toBeTruthy();
    expect(JSON.stringify(deletedEvent)).not.toMatch(/password|tokenHash/i);
  });

  it("covers My Work tabs and completion trend timezone bucketing", async () => {
    const tz = "Asia/Ho_Chi_Minh";
    const owner = await registerLoginAndCreateWorkspace({
      timezone: tz,
      locale: "vi",
    });
    const today = todayYmd(tz);
    const [ty, tm, td] = today.split("-").map(Number);
    const yestUtc = new Date(Date.UTC(ty!, tm! - 1, td! - 1));
    const yesterday = zonedDateTimeToUtc(
      yestUtc.getUTCFullYear(),
      yestUtc.getUTCMonth() + 1,
      yestUtc.getUTCDate(),
      10,
      0,
      0,
      tz,
    );
    const tomorrowYmd = addCalendarDays(today, 1);
    const tomorrowDue = zonedDateTimeToUtc(
      Number(tomorrowYmd.slice(0, 4)),
      Number(tomorrowYmd.slice(5, 7)),
      Number(tomorrowYmd.slice(8, 10)),
      12,
      0,
      0,
      tz,
    );
    const todayDue = zonedDateTimeToUtc(
      Number(today.slice(0, 4)),
      Number(today.slice(5, 7)),
      Number(today.slice(8, 10)),
      15,
      0,
      0,
      tz,
    );

    // 23:30 local today → still today in tz; same instant is next calendar day in UTC
    const lateLocalComplete = zonedDateTimeToUtc(
      Number(today.slice(0, 4)),
      Number(today.slice(5, 7)),
      Number(today.slice(8, 10)),
      23,
      30,
      0,
      tz,
    );

    await prisma.task.createMany({
      data: [
        {
          workspaceId: owner.workspaceId!,
          title: "MW today",
          status: "TODO",
          dueDate: todayDue,
          createdById: owner.userId!,
          assigneeId: owner.userId!,
        },
        {
          workspaceId: owner.workspaceId!,
          title: "MW upcoming",
          status: "TODO",
          dueDate: tomorrowDue,
          createdById: owner.userId!,
          assigneeId: owner.userId!,
        },
        {
          workspaceId: owner.workspaceId!,
          title: "MW overdue",
          status: "TODO",
          dueDate: yesterday,
          createdById: owner.userId!,
          assigneeId: owner.userId!,
        },
        {
          workspaceId: owner.workspaceId!,
          title: "MW in progress",
          status: "IN_PROGRESS",
          dueDate: tomorrowDue,
          createdById: owner.userId!,
          assigneeId: owner.userId!,
        },
        {
          workspaceId: owner.workspaceId!,
          title: "MW completed local late",
          status: "DONE",
          dueDate: todayDue,
          completedAt: lateLocalComplete,
          createdById: owner.userId!,
          assigneeId: owner.userId!,
        },
      ],
    });

    const tabs = [
      ["today", "MW today"],
      ["upcoming", "MW upcoming"],
      ["overdue", "MW overdue"],
      ["in-progress", "MW in progress"],
      ["completed", "MW completed local late"],
    ] as const;

    for (const [tab, title] of tabs) {
      const res = await request(owner.app)
        .get(`/api/v1/workspaces/${owner.workspaceId}/dashboard/my-work`)
        .query({ tab, timezone: tz, from: today, to: today, limit: 50 })
        .set("Authorization", `Bearer ${owner.accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.tab).toBe(tab);
      expect(res.body.data.total).toBeGreaterThanOrEqual(1);
      expect(
        res.body.data.items.some((t: { title: string }) => t.title === title),
      ).toBe(true);
    }

    const summary = await request(owner.app)
      .get(`/api/v1/workspaces/${owner.workspaceId}/dashboard/summary`)
      .query({ timezone: tz, from: today, to: today })
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(summary.status).toBe(200);
    expect(summary.body.data.stats.completed).toBe(1);

    const charts = await request(owner.app)
      .get(`/api/v1/workspaces/${owner.workspaceId}/dashboard/charts`)
      .query({ timezone: tz, from: today, to: today })
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(charts.status).toBe(200);
    expect(charts.body.data.available).toBe(true);
    const trend = charts.body.data.completionTrend as Array<{
      date: string;
      count: number;
    }>;
    expect(trend.some((row) => row.date === today && row.count >= 1)).toBe(true);
    const utcDate = lateLocalComplete.toISOString().slice(0, 10);
    if (utcDate !== today) {
      expect(trend.some((row) => row.date === utcDate)).toBe(false);
    }
  });

  it("hides ACTOR_ONLY activity from other users including managers", async () => {
    const owner = await registerLoginAndCreateWorkspace({
      type: "ORGANIZATION",
    });
    const manager = await inviteAndAcceptMember({
      app: owner.app,
      ownerToken: owner.accessToken!,
      workspaceId: owner.workspaceId!,
      email: `mgr-${Date.now()}@example.com`,
      roleKey: "manager",
      fullName: "Manager User",
    });

    await prisma.activityEvent.create({
      data: {
        workspaceId: owner.workspaceId!,
        actorId: owner.userId!,
        action: "task.updated",
        resourceType: "task",
        resourceId: owner.userId!,
        summary: "Private actor-only note",
        visibility: "ACTOR_ONLY",
        sensitive: false,
        metadata: {
          title: "Secret",
          status: "TODO",
          assigneeId: manager.userId,
          createdById: owner.userId!,
        },
      },
    });

    const ownerFeed = await request(owner.app)
      .get(`/api/v1/workspaces/${owner.workspaceId}/dashboard/activity`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(ownerFeed.status).toBe(200);
    expect(
      ownerFeed.body.data.some(
        (e: { summary: string }) => e.summary === "Private actor-only note",
      ),
    ).toBe(true);

    const managerFeed = await request(owner.app)
      .get(`/api/v1/workspaces/${owner.workspaceId}/dashboard/activity`)
      .set("Authorization", `Bearer ${manager.accessToken}`);
    expect(managerFeed.status).toBe(200);
    expect(
      managerFeed.body.data.some(
        (e: { summary: string }) => e.summary === "Private actor-only note",
      ),
    ).toBe(false);
  });
});

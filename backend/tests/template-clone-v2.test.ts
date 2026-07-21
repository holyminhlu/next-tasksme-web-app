import request from "supertest";
import { describe, expect, it } from "vitest";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../src/config/database.js";
import {
  claimPendingCloneJobs,
  heartbeatCloneJob,
  retryCloneJob,
} from "../src/modules/templates/clone-jobs.service.js";
import { canonicalizeTemplateContent } from "../src/lib/template-content.js";
import { registerLoginAndCreateWorkspace } from "./helpers.js";

describe("template clone v2", () => {
  it("clones full project content and enforces idempotency hashes", async () => {
    const owner = await registerLoginAndCreateWorkspace({
      name: "Clone V2 Fidelity",
      timezone: "America/New_York",
    });
    const workspaceId = owner.workspaceId!;
    const base = `/api/v1/workspaces/${workspaceId}/templates`;
    const auth = { Authorization: `Bearer ${owner.accessToken}` };
    const contentJson = {
      schemaVersion: 2,
      project: {
        status: "ACTIVE",
        priority: "HIGH",
        visibility: "PRIVATE",
        completionPolicy: "BLOCK",
      },
      memberPlaceholders: [],
      workflow: {
        name: "Clone workflow",
        stages: [
          {
            key: "todo",
            name: "Todo",
            category: "NOT_STARTED",
            position: 0,
            isInitial: true,
            isTerminal: false,
            isActive: true,
          },
          {
            key: "done",
            name: "Done",
            category: "COMPLETED",
            position: 1,
            isInitial: false,
            isTerminal: true,
            isActive: true,
          },
        ],
        transitions: [
          {
            fromKey: "todo",
            toKey: "done",
            requiredPermission: "tasks:update",
            conditionsJson: {
              version: 1,
              all: [
                {
                  field: "task.assigneeId",
                  operator: "isSet",
                },
              ],
            },
          },
        ],
      },
      tags: [{ key: "urgent", name: "Clone urgent", color: "#ff0000" }],
      customFields: [
        {
          key: "cost",
          name: "Cost",
          fieldType: "NUMBER",
          isRequired: false,
          options: [],
          defaultValue: 10,
          position: 0,
          isActive: true,
        },
      ],
      milestones: [
        {
          key: "m1",
          name: "Release",
          status: "PLANNED",
          position: 0,
          dueOffsetDays: 5,
        },
      ],
      tasks: [
        {
          key: "parent",
          title: "Parent",
          priority: "HIGH",
          stageKey: "todo",
          milestoneKey: "m1",
          startOffsetDays: 0,
          dueOffsetDays: 2,
          position: 0,
          checklist: [{ title: "Check", position: 0, isCompleted: false }],
          tagKeys: ["urgent"],
          customValues: { cost: 25 },
        },
        {
          key: "child",
          title: "Child",
          priority: "MEDIUM",
          stageKey: "todo",
          parentKey: "parent",
          subtaskPosition: 0,
          position: 1,
          checklist: [],
          tagKeys: [],
          customValues: {},
        },
      ],
      dependencies: [
        {
          predecessorKey: "parent",
          successorKey: "child",
          dependencyType: "FINISH_TO_START",
        },
      ],
    };
    const created = await request(owner.app)
      .post(base)
      .set(auth)
      .send({ name: "Complete template", contentJson });
    expect(created.status).toBe(201);
    const published = await request(owner.app)
      .post(`${base}/${created.body.data.id}/publish`)
      .set(auth)
      .send({});
    expect(published.status).toBe(200);

    const payload = {
      projectName: "Fidelity project",
      startAt: "2026-03-07T17:00:00.000Z",
      idempotencyKey: `clone-v2-${Date.now()}`,
    };
    const cloned = await request(owner.app)
      .post(`${base}/${published.body.data.id}/clone`)
      .set(auth)
      .send(payload);
    expect(cloned.status).toBe(202);
    const projectId = cloned.body.data.projectId as string;
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        milestones: true,
        customFieldDefinitions: true,
        tasks: {
          orderBy: { rank: "asc" },
          include: { checklistItems: true, taskTags: true, customFieldValues: true },
        },
      },
    });
    expect(project?.priority).toBe("HIGH");
    expect(project?.visibility).toBe("PRIVATE");
    expect(project?.milestones).toHaveLength(1);
    expect(project?.customFieldDefinitions).toHaveLength(1);
    expect(project?.tasks.map((task) => task.rank)).toEqual([
      "0000000000001000",
      "0000000000002000",
    ]);
    expect(project?.tasks[1]?.parentTaskId).toBe(project?.tasks[0]?.id);
    expect(project?.tasks[0]?.checklistItems).toHaveLength(1);
    expect(project?.tasks[0]?.taskTags).toHaveLength(1);
    expect(project?.tasks[0]?.customFieldValues[0]?.valueJson).toBe(25);

    const replay = await request(owner.app)
      .post(`${base}/${published.body.data.id}/clone`)
      .set(auth)
      .send(payload);
    expect(replay.body.data.cloneJobId).toBe(cloned.body.data.cloneJobId);
    const mismatch = await request(owner.app)
      .post(`${base}/${published.body.data.id}/clone`)
      .set(auth)
      .send({ ...payload, projectName: "Different" });
    expect(mismatch.status).toBe(409);
  });

  it("reclaims expired leases, fences stale workers, and retries failed jobs", async () => {
    const owner = await registerLoginAndCreateWorkspace({ name: "Clone Worker Lease" });
    const workspaceId = owner.workspaceId!;
    const minimal = {
      schemaVersion: 2 as const,
      project: {
        status: "ACTIVE" as const,
        priority: "MEDIUM" as const,
        visibility: "WORKSPACE" as const,
        completionPolicy: "WARN_ONLY" as const,
      },
      memberPlaceholders: [],
      workflow: {
        name: "Worker workflow",
        stages: [
          {
            key: "only",
            name: "Only",
            category: "COMPLETED" as const,
            position: 0,
            isInitial: true,
            isTerminal: true,
            isActive: true,
          },
        ],
        transitions: [],
      },
      tags: [],
      customFields: [],
      milestones: [],
      tasks: [],
      dependencies: [],
    };
    const canonical = canonicalizeTemplateContent(minimal);
    const template = await prisma.projectTemplate.create({
      data: {
        workspaceId,
        name: "Worker template",
        version: 1,
        status: "PUBLISHED",
        contentJson: canonical.content as unknown as Prisma.InputJsonValue,
        contentHash: canonical.hash,
        publishedAt: new Date(),
        createdById: owner.userId!,
      },
    });
    const job = await prisma.cloneJob.create({
      data: {
        workspaceId,
        templateId: template.id,
        idempotencyKey: `lease-${Date.now()}`,
        requestHash: "request",
        templateContentHash: canonical.hash,
        payloadJson: { projectName: "Lease project", actorId: owner.userId },
        status: "PROCESSING",
        leaseToken: "stale-token",
        leaseExpiresAt: new Date(Date.now() - 1000),
        createdById: owner.userId!,
      },
    });
    const claimed = await claimPendingCloneJobs(1, new Date(), "test-worker");
    const lease = claimed.find((item) => item.id === job.id)!;
    expect(lease.leaseToken).not.toBe("stale-token");
    expect(await heartbeatCloneJob(job.id, "stale-token", 20)).toBe(false);
    expect(await heartbeatCloneJob(job.id, lease.leaseToken, 20)).toBe(true);

    await prisma.cloneJob.update({
      where: { id: job.id },
      data: { status: "FAILED", leaseToken: null, leaseExpiresAt: null },
    });
    const retried = await retryCloneJob(workspaceId, job.id);
    expect(retried.status).toBe("PENDING");
    expect(retried.attempts).toBe(0);
  });
});

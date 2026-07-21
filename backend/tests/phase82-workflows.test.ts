import request from "supertest";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/config/database.js";
import { registerLoginAndCreateWorkspace } from "./helpers.js";

describe("phase 8.2 workflows and templates", () => {
  async function setup(name: string) {
    const owner = await registerLoginAndCreateWorkspace({ name });
    const workspaceId = owner.workspaceId as string;
    const projectsBase = `/api/v1/workspaces/${workspaceId}/projects`;
    const templatesBase = `/api/v1/workspaces/${workspaceId}/templates`;
    const auth = { Authorization: `Bearer ${owner.accessToken}` };
    return { owner, workspaceId, projectsBase, templatesBase, auth };
  }

  it("creates projects with default published workflow", async () => {
    const { owner, projectsBase, auth } = await setup("Workflow Default");
    const created = await request(owner.app)
      .post(projectsBase)
      .set(auth)
      .send({ name: "Workflow Project", code: "WF-001" });
    expect(created.status).toBe(201);
    const projectId = created.body.data.id as string;

    const workflow = await request(owner.app)
      .get(`${projectsBase}/${projectId}/workflow`)
      .set(auth);
    expect(workflow.status).toBe(200);
    expect(workflow.body.data.published).toBeTruthy();
    expect(workflow.body.data.published.stages.length).toBeGreaterThan(0);

    const applied = await prisma.projectWorkflow.findUnique({ where: { projectId } });
    expect(applied).toBeTruthy();
  });

  it("creates draft, edits stages, and publishes with task migration", async () => {
    const { owner, workspaceId, projectsBase, auth } = await setup("Workflow Publish");
    const created = await request(owner.app)
      .post(projectsBase)
      .set(auth)
      .send({ name: "Publish Project" });
    const projectId = created.body.data.id as string;

    const task = await request(owner.app)
      .post(`/api/v1/workspaces/${workspaceId}/tasks`)
      .set(auth)
      .send({ title: "Migrate me", projectId });
    expect(task.status).toBe(201);

    const draft = await request(owner.app)
      .post(`${projectsBase}/${projectId}/workflow/draft`)
      .set(auth)
      .send({});
    expect(draft.status).toBe(201);
    const draftWorkflowId = draft.body.data.id as string;
    const publishedStages = (
      await request(owner.app).get(`${projectsBase}/${projectId}/workflow`).set(auth)
    ).body.data.published.stages as Array<{ id: string; name: string }>;

    const newStage = await request(owner.app)
      .post(`${projectsBase}/${projectId}/workflow/drafts/${draftWorkflowId}/stages`)
      .set(auth)
      .send({ name: "Quality Check", category: "IN_PROGRESS" });
    expect(newStage.status).toBe(201);

    const draftStages = (
      await request(owner.app)
        .get(`${projectsBase}/${projectId}/workflow/drafts/${draftWorkflowId}`)
        .set(auth)
    ).body.data.stages as Array<{ id: string; name: string }>;

    const publish = await request(owner.app)
      .post(`${projectsBase}/${projectId}/workflow/publish`)
      .set(auth)
      .send({
        draftWorkflowId,
        stageMappings: publishedStages.map((stage) => ({
          fromStageId: stage.id,
          toStageId:
            stage.id === task.body.data.workflowStageId
              ? draftStages.find((item) => item.name === "Done")!.id
              : (draftStages.find((item) => item.name === stage.name)?.id ??
                draftStages[0]!.id),
        })),
        legacyStatusMappings: [],
      });
    expect(publish.status).toBe(200);
    expect(publish.body.data.workflowVersion).toBeGreaterThan(0);

    const updatedTask = await prisma.task.findUnique({
      where: { id: task.body.data.id as string },
    });
    expect(updatedTask?.workflowStageId).toBeTruthy();
    expect(updatedTask?.status).toBe("DONE");
    expect(updatedTask?.completedAt).toBeTruthy();
    expect(updatedTask?.version).toBe(2);
    const history = await prisma.taskStatusHistory.findFirst({
      where: { taskId: task.body.data.id as string },
      orderBy: { changedAt: "desc" },
    });
    expect(history).toMatchObject({ fromStatus: "TODO", toStatus: "DONE" });

    const repeat = await request(owner.app)
      .post(`${projectsBase}/${projectId}/workflow/publish`)
      .set(auth)
      .send({
        draftWorkflowId,
        stageMappings: [],
        legacyStatusMappings: [],
      });
    expect([404, 409]).toContain(repeat.status);
  });

  it("denies stages and drafts from another project workflow", async () => {
    const { owner, workspaceId, projectsBase, auth } = await setup("Workflow Isolation");
    const first = await request(owner.app)
      .post(projectsBase)
      .set(auth)
      .send({ name: "First Project" });
    const second = await request(owner.app)
      .post(projectsBase)
      .set(auth)
      .send({ name: "Second Project" });
    const firstId = first.body.data.id as string;
    const secondId = second.body.data.id as string;
    const task = await request(owner.app)
      .post(`/api/v1/workspaces/${workspaceId}/tasks`)
      .set(auth)
      .send({ title: "Stay in first workflow", projectId: firstId });
    const secondWorkflow = (
      await request(owner.app).get(`${projectsBase}/${secondId}/workflow`).set(auth)
    ).body.data.published;

    const crossWorkflowMove = await request(owner.app)
      .patch(`/api/v1/workspaces/${workspaceId}/tasks/${task.body.data.id}/move`)
      .set(auth)
      .send({
        targetStageId: secondWorkflow.stages[1].id,
        version: task.body.data.version,
      });
    expect([400, 404]).toContain(crossWorkflowMove.status);

    const draft = await request(owner.app)
      .post(`${projectsBase}/${firstId}/workflow/draft`)
      .set(auth)
      .send({});
    const draftId = draft.body.data.id as string;
    const crossProjectRead = await request(owner.app)
      .get(`${projectsBase}/${secondId}/workflow/drafts/${draftId}`)
      .set(auth);
    expect(crossProjectRead.status).toBe(400);
    const crossProjectPublish = await request(owner.app)
      .post(`${projectsBase}/${secondId}/workflow/publish`)
      .set(auth)
      .send({ draftWorkflowId: draftId, stageMappings: [], legacyStatusMappings: [] });
    expect(crossProjectPublish.status).toBe(404);
  });

  it("enforces workflow edges for legacy status updates", async () => {
    const { owner, workspaceId, projectsBase, auth } = await setup("Workflow Edges");
    const project = await request(owner.app)
      .post(projectsBase)
      .set(auth)
      .send({ name: "Edge Project" });
    const projectId = project.body.data.id as string;
    const task = await request(owner.app)
      .post(`/api/v1/workspaces/${workspaceId}/tasks`)
      .set(auth)
      .send({ title: "No direct completion", projectId });

    const denied = await request(owner.app)
      .patch(`/api/v1/workspaces/${workspaceId}/tasks/${task.body.data.id}/status`)
      .set(auth)
      .send({ status: "DONE", version: task.body.data.version });
    expect(denied.status).toBe(400);
    const current = await prisma.task.findUniqueOrThrow({
      where: { id: task.body.data.id as string },
    });
    expect(current.status).toBe("TODO");
    expect(current.workflowStageId).toBe(task.body.data.workflowStageId);

    const allowed = await request(owner.app)
      .patch(`/api/v1/workspaces/${workspaceId}/tasks/${task.body.data.id}/status`)
      .set(auth)
      .send({ status: "IN_PROGRESS", version: current.version });
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.status).toBe("IN_PROGRESS");
    expect(allowed.body.data.workflowStage.name).toBe("In Progress");

    const targetProject = await request(owner.app)
      .post(projectsBase)
      .set(auth)
      .send({ name: "Reassignment Target" });
    const beforeReassignment = await prisma.task.findUniqueOrThrow({
      where: { id: task.body.data.id as string },
    });
    const reassigned = await request(owner.app)
      .patch(`/api/v1/workspaces/${workspaceId}/tasks/${task.body.data.id}`)
      .set(auth)
      .send({
        projectId: targetProject.body.data.id,
        version: beforeReassignment.version,
      });
    expect(reassigned.status).toBe(200);
    const targetApplied = await prisma.projectWorkflow.findUniqueOrThrow({
      where: { projectId: targetProject.body.data.id as string },
    });
    const reassignedStage = await prisma.workflowStage.findUniqueOrThrow({
      where: { id: reassigned.body.data.workflowStageId as string },
    });
    expect(reassignedStage.workflowId).toBe(targetApplied.workflowId);

    const beforeProjectless = await prisma.task.findUniqueOrThrow({
      where: { id: task.body.data.id as string },
    });
    const projectless = await request(owner.app)
      .patch(`/api/v1/workspaces/${workspaceId}/tasks/${task.body.data.id}`)
      .set(auth)
      .send({ projectId: null, version: beforeProjectless.version });
    expect(projectless.status).toBe(200);
    expect(projectless.body.data.workflowStageId).toBeNull();
  });

  it("deleting a draft stage leaves live tasks unchanged", async () => {
    const { owner, workspaceId, projectsBase, auth } = await setup("Draft Delete");
    const project = await request(owner.app)
      .post(projectsBase)
      .set(auth)
      .send({ name: "Delete Draft Stage" });
    const projectId = project.body.data.id as string;
    const task = await request(owner.app)
      .post(`/api/v1/workspaces/${workspaceId}/tasks`)
      .set(auth)
      .send({ title: "Live task", projectId });
    const before = await prisma.task.findUniqueOrThrow({
      where: { id: task.body.data.id as string },
    });
    const draft = await request(owner.app)
      .post(`${projectsBase}/${projectId}/workflow/draft`)
      .set(auth)
      .send({});
    const stage = draft.body.data.stages.find(
      (item: { name: string }) => item.name === "Review",
    );

    const deleted = await request(owner.app)
      .delete(
        `${projectsBase}/${projectId}/workflow/drafts/${draft.body.data.id}/stages/${stage.id}?moveToStageId=${draft.body.data.stages[0].id}`,
      )
      .set(auth);
    expect(deleted.status).toBe(200);
    const after = await prisma.task.findUniqueOrThrow({ where: { id: before.id } });
    expect(after).toMatchObject({
      status: before.status,
      workflowStageId: before.workflowStageId,
      version: before.version,
    });
  });

  it("keeps same-named project workflow families independent", async () => {
    const { owner, projectsBase, auth } = await setup("Workflow Families");
    const first = await request(owner.app)
      .post(projectsBase)
      .set(auth)
      .send({ name: "Same Name" });
    const second = await request(owner.app)
      .post(projectsBase)
      .set(auth)
      .send({ name: "Same Name" });
    const projects = [first.body.data.id as string, second.body.data.id as string];
    const applied = await Promise.all(
      projects.map((projectId) =>
        prisma.projectWorkflow.findUniqueOrThrow({
          where: { projectId },
          include: { workflow: true },
        }),
      ),
    );
    expect(applied[0].workflow.familyId).not.toBe(applied[1].workflow.familyId);

    for (const projectId of projects) {
      const draft = await request(owner.app)
        .post(`${projectsBase}/${projectId}/workflow/draft`)
        .set(auth)
        .send({});
      const published = await request(owner.app)
        .post(`${projectsBase}/${projectId}/workflow/publish`)
        .set(auth)
        .send({
          draftWorkflowId: draft.body.data.id,
          stageMappings: [],
          legacyStatusMappings: [],
        });
      expect(published.status).toBe(200);
      expect(published.body.data.workflowVersion).toBe(2);
    }
  });

  it("lists system templates and clones into a project", async () => {
    const { owner, templatesBase, auth } = await setup("Template Clone");
    const listed = await request(owner.app).get(`${templatesBase}?pageSize=20`).set(auth);
    expect(listed.status).toBe(200);
    expect(Array.isArray(listed.body.data)).toBe(true);

    let templateId = listed.body.data[0]?.id as string | undefined;
    if (!templateId) {
      const created = await request(owner.app)
        .post(templatesBase)
        .set(auth)
        .send({ name: "Quick Start" });
      templateId = created.body.data.id as string;
      const published = await request(owner.app)
        .post(`${templatesBase}/${templateId}/publish`)
        .set(auth)
        .send({});
      expect(published.status).toBe(200);
      templateId = published.body.data.id as string;
    }

    const clone = await request(owner.app)
      .post(`${templatesBase}/${templateId}/clone`)
      .set(auth)
      .send({
        projectName: "From Template",
        idempotencyKey: `clone-${Date.now()}`,
      });
    expect(clone.status).toBe(202);
    expect(clone.body.data.projectId).toBeTruthy();

    const projectWorkflow = await prisma.projectWorkflow.findUnique({
      where: { projectId: clone.body.data.projectId as string },
    });
    expect(projectWorkflow).toBeTruthy();

    const tasks = await prisma.task.count({
      where: { projectId: clone.body.data.projectId as string, deletedAt: null },
    });
    expect(tasks).toBeGreaterThan(0);
  });
});

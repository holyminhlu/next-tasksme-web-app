import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const apiBaseUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:4001";
const e2eCredential = randomUUID();

type Envelope<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

type Stage = {
  id: string;
  name: string;
  category: string;
  position: number;
};

type Workflow = {
  id: string;
  version: number;
  stages: Stage[];
  transitions: Array<{
    fromStageId: string;
    toStageId: string;
    requiredPermission?: string | null;
    conditionsJson?: Record<string, unknown>;
  }>;
};

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const ownerEmail = `phase82-owner-${runId}@example.test`;
const outsiderEmail = `phase82-outsider-${runId}@example.test`;

const state: {
  token: string;
  workspaceId: string;
  projectId: string;
  templateId: string;
} = {
  token: "",
  workspaceId: "",
  projectId: "",
  templateId: "",
};

async function api<T>(
  request: APIRequestContext,
  method: "get" | "post" | "patch" | "put",
  path: string,
  options: { token?: string; data?: unknown } = {},
): Promise<T> {
  const response = await request[method](`${apiBaseUrl}/api/v1${path}`, {
    data: options.data,
    headers: options.token ? { Authorization: `Bearer ${options.token}` } : undefined,
  });
  const body = (await response.json()) as Envelope<T>;
  expect(response.ok(), `${method.toUpperCase()} ${path}: ${JSON.stringify(body)}`).toBe(
    true,
  );
  expect(body.success).toBe(true);
  return (body as { success: true; data: T }).data;
}

async function browserLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ownerEmail);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(e2eCredential);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

function templateContent(taskCount = 2) {
  return {
    schemaVersion: 2,
    project: {
      description: "Created by the Phase 8.2 release smoke.",
      status: "ACTIVE",
      priority: "MEDIUM",
      visibility: "WORKSPACE",
      completionPolicy: "WARN_ONLY",
    },
    memberPlaceholders: [],
    workflow: {
      name: "Release workflow",
      stages: [
        {
          key: "todo",
          name: "To do",
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
      transitions: [{ fromKey: "todo", toKey: "done", conditionsJson: {} }],
    },
    tags: [],
    customFields: [],
    milestones: [],
    tasks: Array.from({ length: taskCount }, (_, index) => ({
      key: `task-${index + 1}`,
      title: `Template task ${index + 1}`,
      priority: "MEDIUM",
      stageKey: "todo",
      position: index,
      checklist: [],
      tagKeys: [],
      customValues: {},
    })),
    dependencies: [],
  };
}

test.describe.serial("Phase 8.2 release smoke", () => {
  test.beforeAll(async ({ request }) => {
    await api(request, "post", "/auth/register", {
      data: {
        email: ownerEmail,
        password: e2eCredential,
        confirmPassword: e2eCredential,
        fullName: "Phase 82 Owner",
      },
    });
    const login = await api<{ accessToken: string }>(request, "post", "/auth/login", {
      data: { email: ownerEmail, password: e2eCredential, rememberMe: false },
    });
    state.token = login.accessToken;

    const workspace = await api<{ id: string }>(request, "post", "/workspaces", {
      token: state.token,
      data: {
        type: "ORGANIZATION",
        name: `Phase 82 Smoke ${runId}`,
        timezone: "UTC",
        locale: "en",
      },
    });
    state.workspaceId = workspace.id;
    await api(request, "post", "/auth/select-workspace", {
      token: state.token,
      data: { workspaceId: state.workspaceId },
    });
    await api(request, "post", `/workspaces/${state.workspaceId}/onboarding/complete`, {
      token: state.token,
    });
  });

  test("publishes a workflow, moves a task, and enforces workspace access", async ({
    page,
    request,
  }) => {
    const projectsPath = `/workspaces/${state.workspaceId}/projects`;
    const project = await api<{ id: string }>(request, "post", projectsPath, {
      token: state.token,
      data: { name: `Workflow Smoke ${runId}`, code: `WF_${runId.slice(-6)}` },
    });
    state.projectId = project.id;

    const task = await api<{ id: string; version: number }>(
      request,
      "post",
      `/workspaces/${state.workspaceId}/tasks`,
      {
        token: state.token,
        data: {
          title: "Move through the published workflow",
          projectId: state.projectId,
        },
      },
    );

    const current = await api<{ published: Workflow }>(
      request,
      "get",
      `${projectsPath}/${state.projectId}/workflow`,
      { token: state.token },
    );
    const draft = await api<Workflow>(
      request,
      "post",
      `${projectsPath}/${state.projectId}/workflow/draft`,
      { token: state.token, data: {} },
    );
    const added = await api<Stage>(
      request,
      "post",
      `${projectsPath}/${state.projectId}/workflow/drafts/${draft.id}/stages`,
      {
        token: state.token,
        data: { name: "Quality Gate", category: "IN_PROGRESS" },
      },
    );
    const quality = await api<Stage>(
      request,
      "patch",
      `${projectsPath}/${state.projectId}/workflow/drafts/${draft.id}/stages/${added.id}`,
      { token: state.token, data: { name: "Quality Review", color: "#7c3aed" } },
    );
    const editedDraft = await api<Workflow>(
      request,
      "get",
      `${projectsPath}/${state.projectId}/workflow/drafts/${draft.id}`,
      { token: state.token },
    );
    const inProgress = editedDraft.stages.find((stage) => stage.name === "In Progress")!;
    const done = editedDraft.stages.find((stage) => stage.name === "Done")!;
    await api(
      request,
      "put",
      `${projectsPath}/${state.projectId}/workflow/drafts/${draft.id}/transitions`,
      {
        token: state.token,
        data: {
          transitions: [
            ...editedDraft.transitions.map((transition) => ({
              fromStageId: transition.fromStageId,
              toStageId: transition.toStageId,
              requiredPermission: transition.requiredPermission ?? null,
              conditionsJson: transition.conditionsJson ?? {},
            })),
            { fromStageId: inProgress.id, toStageId: quality.id, conditionsJson: {} },
            { fromStageId: quality.id, toStageId: done.id, conditionsJson: {} },
          ],
        },
      },
    );
    await api(
      request,
      "post",
      `${projectsPath}/${state.projectId}/workflow/drafts/${draft.id}/validate`,
      {
        token: state.token,
        data: {},
      },
    );

    const latestDraft = await api<Workflow>(
      request,
      "get",
      `${projectsPath}/${state.projectId}/workflow/drafts/${draft.id}`,
      { token: state.token },
    );
    await api(request, "post", `${projectsPath}/${state.projectId}/workflow/publish`, {
      token: state.token,
      data: {
        draftWorkflowId: draft.id,
        stageMappings: current.published.stages.map((stage) => ({
          fromStageId: stage.id,
          toStageId:
            latestDraft.stages.find((candidate) => candidate.name === stage.name)?.id ??
            latestDraft.stages[0]!.id,
        })),
        legacyStatusMappings: [],
      },
    });

    const publishedState = await api<{ published: Workflow }>(
      request,
      "get",
      `${projectsPath}/${state.projectId}/workflow`,
      { token: state.token },
    );
    const publishedInProgress = publishedState.published.stages.find(
      (stage) => stage.name === "In Progress",
    )!;
    const publishedQuality = publishedState.published.stages.find(
      (stage) => stage.name === "Quality Review",
    )!;
    const migratedTask = await api<{ version: number }>(
      request,
      "get",
      `/workspaces/${state.workspaceId}/tasks/${task.id}`,
      { token: state.token },
    );
    const movedToProgress = await api<{
      version: number;
      workflowStage: { name: string };
    }>(request, "patch", `/workspaces/${state.workspaceId}/tasks/${task.id}/move`, {
      token: state.token,
      data: {
        targetStageId: publishedInProgress.id,
        version: migratedTask.version,
      },
    });
    const moved = await api<{ version: number; workflowStage: { name: string } }>(
      request,
      "patch",
      `/workspaces/${state.workspaceId}/tasks/${task.id}/move`,
      {
        token: state.token,
        data: {
          targetStageId: publishedQuality.id,
          version: movedToProgress.version,
        },
      },
    );
    expect(moved.workflowStage.name).toBe("Quality Review");

    await api(request, "post", "/auth/register", {
      data: {
        email: outsiderEmail,
        password: e2eCredential,
        confirmPassword: e2eCredential,
        fullName: "Read Only Outsider",
      },
    });
    const outsider = await api<{ accessToken: string }>(request, "post", "/auth/login", {
      data: { email: outsiderEmail, password: e2eCredential, rememberMe: false },
    });
    const denied = await request.get(
      `${apiBaseUrl}/api/v1${projectsPath}/${state.projectId}/workflow`,
      { headers: { Authorization: `Bearer ${outsider.accessToken}` } },
    );
    expect([403, 404]).toContain(denied.status());

    await browserLogin(page);
    await page.goto(`/projects/${state.projectId}?tab=workflow`);
    await expect(page.getByText("Published v2")).toBeVisible();
    await expect(page.getByText("Quality Review", { exact: true })).toBeVisible();
  });

  test("edits, validates, publishes, and clones templates", async ({ page, request }) => {
    const templatesPath = `/workspaces/${state.workspaceId}/templates`;
    const draft = await api<{ id: string }>(request, "post", templatesPath, {
      token: state.token,
      data: {
        name: `Release Template ${runId}`,
        description: "Initial smoke template",
        contentJson: templateContent(),
      },
    });
    state.templateId = draft.id;

    await browserLogin(page);
    await page.goto(`/templates/${state.templateId}`);
    await page.getByLabel("Name").fill(`Validated Template ${runId}`);
    await page.getByLabel("Description").fill("Edited in the critical browser flow");
    await page
      .getByLabel("Template content (JSON)")
      .fill(JSON.stringify(templateContent(3), null, 2));
    await page.getByRole("button", { name: "Save & validate" }).click();
    await expect(page.getByText("Server validated schema v2", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("PUBLISHED", { exact: true })).toBeVisible();
    await expect(page.getByRole("note").filter({ hasText: "immutable" })).toBeVisible();

    const publishedTemplates = await api<
      Array<{ id: string; name: string; status: string }>
    >(request, "get", `${templatesPath}?status=PUBLISHED`, {
      token: state.token,
    });
    const publishedTemplate = publishedTemplates.find(
      (template) => template.name === `Validated Template ${runId}`,
    )!;
    expect(publishedTemplate).toBeTruthy();
    state.templateId = publishedTemplate.id;
    const clone = await api<{ mode: string; cloneJobId: string; projectId: string }>(
      request,
      "post",
      `${templatesPath}/${state.templateId}/clone`,
      {
        token: state.token,
        data: {
          projectName: `Small Clone ${runId}`,
          idempotencyKey: `small-clone-${runId}`,
          memberBindings: {},
        },
      },
    );
    expect(clone.mode).toBe("sync");
    expect(clone.projectId).toBeTruthy();
    await page.goto(`/projects/${clone.projectId}`);
    await expect(
      page.getByRole("heading", { name: `Small Clone ${runId}` }),
    ).toBeVisible();

    const largeDraft = await api<{ id: string }>(request, "post", templatesPath, {
      token: state.token,
      data: {
        name: `Async Template ${runId}`,
        contentJson: templateContent(101),
      },
    });
    await api(request, "post", `${templatesPath}/${largeDraft.id}/validate`, {
      token: state.token,
      data: {},
    });
    const largePublished = await api<{ id: string }>(
      request,
      "post",
      `${templatesPath}/${largeDraft.id}/publish`,
      {
        token: state.token,
        data: {},
      },
    );
    const asyncClone = await api<{
      mode: string;
      cloneJobId: string;
      projectId: null;
    }>(request, "post", `${templatesPath}/${largePublished.id}/clone`, {
      token: state.token,
      data: {
        projectName: `Async Clone ${runId}`,
        idempotencyKey: `async-clone-${runId}`,
        memberBindings: {},
      },
    });
    expect(asyncClone).toMatchObject({ mode: "async", projectId: null });
    const job = await api<{ status: string; progress: number }>(
      request,
      "get",
      `${templatesPath}/clone-jobs/${asyncClone.cloneJobId}`,
      { token: state.token },
    );
    expect(["PENDING", "PROCESSING", "COMPLETED"]).toContain(job.status);
    expect(job.progress).toBeGreaterThanOrEqual(0);
  });
});

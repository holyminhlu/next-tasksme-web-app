import request from "supertest";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/config/database.js";
import {
  createWorkspace,
  registerAndLogin,
  registerLoginAndCreateWorkspace,
} from "./helpers.js";

describe("workspace onboarding phase 2", () => {
  it("creates personal and organization workspaces with owner membership and modules", async () => {
    const session = await registerAndLogin();

    const personal = await createWorkspace(
      session.accessToken!,
      { type: "PERSONAL", name: "Personal Space" },
      session.app,
    );
    expect(personal.response.status).toBe(201);
    expect(personal.response.body.data.type).toBe("PERSONAL");
    expect(personal.response.body.data.onboarding.onboardingType).toBe(
      "PERSONAL_OWNER",
    );

    const org = await createWorkspace(
      session.accessToken!,
      {
        type: "ORGANIZATION",
        name: "Acme Org",
        industryCode: "tech",
        companySize: "11-50",
      },
      session.app,
    );
    expect(org.response.status).toBe(201);
    expect(org.response.body.data.type).toBe("ORGANIZATION");

    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: session.userId! },
      include: { role: true },
    });
    expect(memberships).toHaveLength(2);
    expect(memberships.every((item) => item.role.key === "owner")).toBe(true);

    const personalModules = await prisma.workspaceModule.findMany({
      where: { workspaceId: personal.workspaceId! },
    });
    expect(personalModules.some((item) => item.moduleKey === "tasks" && item.core)).toBe(
      true,
    );
    expect(
      personalModules.find((item) => item.moduleKey === "members")?.enabled,
    ).toBe(false);
  });

  it("resumes onboarding progress, applies presets, and creates first project/tasks", async () => {
    const owner = await registerLoginAndCreateWorkspace({
      type: "PERSONAL",
      name: "Solo Desk",
    });

    const progress = await request(owner.app)
      .patch(`/api/v1/workspaces/${owner.workspaceId}/onboarding`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        currentStep: "modules",
        markStepCompleted: "usage_purpose",
        workspace: { usagePurpose: "freelance" },
      });
    expect(progress.status).toBe(200);
    expect(progress.body.data.currentStep).toBe("modules");
    expect(progress.body.data.completedSteps).toContain("usage_purpose");

    const resume = await request(owner.app)
      .get(`/api/v1/workspaces/${owner.workspaceId}/onboarding`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(resume.status).toBe(200);
    expect(resume.body.data.status).toBe("IN_PROGRESS");
    expect(resume.body.data.currentStep).toBe("modules");

    const preset = await request(owner.app)
      .post(`/api/v1/workspaces/${owner.workspaceId}/modules/presets`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ presetKey: "personal" });
    expect(preset.status).toBe(200);

    const disableCore = await request(owner.app)
      .patch(`/api/v1/workspaces/${owner.workspaceId}/modules`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ modules: [{ moduleKey: "tasks", enabled: false }] });
    expect(disableCore.status).toBe(400);

    const firstProject = await request(owner.app)
      .post(`/api/v1/workspaces/${owner.workspaceId}/onboarding/first-project`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        name: "Getting Started",
        tasks: [
          { title: "Add first task", priority: "HIGH" },
          { title: "Invite later", priority: "LOW" },
        ],
      });
    expect(firstProject.status).toBe(201);
    expect(firstProject.body.data.project.workspaceId).toBe(owner.workspaceId);
    expect(firstProject.body.data.tasks).toHaveLength(2);
    expect(
      firstProject.body.data.tasks.every(
        (task: { workspaceId: string }) =>
          task.workspaceId === owner.workspaceId,
      ),
    ).toBe(true);

    const complete = await request(owner.app)
      .post(`/api/v1/workspaces/${owner.workspaceId}/onboarding/complete`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(complete.status).toBe(200);
    expect(complete.body.data.status).toBe("COMPLETED");
  });

  it("blocks invites on personal workspaces and allows after organization create", async () => {
    const session = await registerAndLogin();
    const personal = await createWorkspace(
      session.accessToken!,
      { type: "PERSONAL", name: "Only Me" },
      session.app,
    );

    const blocked = await request(session.app)
      .post(`/api/v1/workspaces/${personal.workspaceId}/invitations`)
      .set("Authorization", `Bearer ${session.accessToken}`)
      .send({ email: `nope-${Date.now()}@example.com`, roleKey: "member" });
    expect(blocked.status).toBe(403);

    const org = await createWorkspace(
      session.accessToken!,
      { type: "ORGANIZATION", name: "Team Space" },
      session.app,
    );
    const allowed = await request(session.app)
      .post(`/api/v1/workspaces/${org.workspaceId}/invitations`)
      .set("Authorization", `Bearer ${session.accessToken}`)
      .send({ email: `yes-${Date.now()}@example.com`, roleKey: "member" });
    expect(allowed.status).toBe(201);
  });

  it("persists lastActiveWorkspaceId on select-workspace and exposes it on /me", async () => {
    const session = await registerAndLogin();
    const first = await createWorkspace(
      session.accessToken!,
      { type: "PERSONAL", name: "First" },
      session.app,
    );
    const second = await createWorkspace(
      session.accessToken!,
      { type: "ORGANIZATION", name: "Second" },
      session.app,
    );

    const selected = await request(session.app)
      .post("/api/v1/auth/select-workspace")
      .set("Authorization", `Bearer ${session.accessToken}`)
      .send({ workspaceId: first.workspaceId });
    expect(selected.status).toBe(200);
    expect(selected.body.data.id).toBe(first.workspaceId);

    const user = await prisma.user.findUnique({ where: { id: session.userId! } });
    expect(user?.lastActiveWorkspaceId).toBe(first.workspaceId);

    const me = await request(session.app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${session.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.lastActiveWorkspaceId).toBe(first.workspaceId);
    expect(me.body.data.workspaces).toHaveLength(2);
    expect(
      me.body.data.workspaces.every(
        (item: { onboardingStatus: string | null }) =>
          item.onboardingStatus === "IN_PROGRESS",
      ),
    ).toBe(true);

    const listed = await request(session.app)
      .get("/api/v1/me/workspaces")
      .set("Authorization", `Bearer ${session.accessToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.map((item: { id: string }) => item.id).sort()).toEqual(
      [first.workspaceId, second.workspaceId].sort(),
    );

    const invalid = await request(session.app)
      .post("/api/v1/auth/select-workspace")
      .set("Authorization", `Bearer ${session.accessToken}`)
      .send({ workspaceId: "00000000-0000-4000-8000-000000000099" });
    expect(invalid.status).toBe(403);
  });

  it("keeps personal workspace when creating a second organization workspace", async () => {
    const session = await registerAndLogin();
    const personal = await createWorkspace(
      session.accessToken!,
      { type: "PERSONAL", name: "Keep Me" },
      session.app,
    );
    const org = await createWorkspace(
      session.accessToken!,
      { type: "ORGANIZATION", name: "New Org" },
      session.app,
    );

    const personalStillThere = await prisma.workspace.findUnique({
      where: { id: personal.workspaceId! },
    });
    expect(personalStillThere?.deletedAt).toBeNull();
    expect(personalStillThere?.type).toBe("PERSONAL");
    expect(org.workspaceId).not.toBe(personal.workspaceId);
  });
});

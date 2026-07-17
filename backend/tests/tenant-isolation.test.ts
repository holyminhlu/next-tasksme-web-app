import request from "supertest";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/config/database.js";
import { registerLoginAndCreateWorkspace } from "./helpers.js";

describe("tenant isolation and owner rules", () => {
  it("allows members to read their own workspace and blocks cross-workspace access", async () => {
    const workspaceA = await registerLoginAndCreateWorkspace({
      email: `owner-a-${Date.now()}@example.com`,
      name: `Workspace A ${Date.now()}`,
      type: "ORGANIZATION",
    });
    const workspaceB = await registerLoginAndCreateWorkspace({
      email: `owner-b-${Date.now()}@example.com`,
      name: `Workspace B ${Date.now()}`,
      type: "ORGANIZATION",
    });

    const own = await request(workspaceA.app)
      .get(`/api/v1/workspaces/${workspaceA.workspaceId}`)
      .set("Authorization", `Bearer ${workspaceA.accessToken}`);
    expect(own.status).toBe(200);

    const cross = await request(workspaceA.app)
      .get(`/api/v1/workspaces/${workspaceB.workspaceId}`)
      .set("Authorization", `Bearer ${workspaceA.accessToken}`);
    expect(cross.status).toBe(403);
  });

  it("prevents demoting the last owner", async () => {
    const owner = await registerLoginAndCreateWorkspace();
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: owner.workspaceId!,
        userId: owner.userId!,
      },
    });

    const response = await request(owner.app)
      .patch(
        `/api/v1/workspaces/${owner.workspaceId}/members/${membership!.id}`,
      )
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ roleKey: "admin" });

    expect(response.status).toBe(403);
    expect(response.body.error.message).toMatch(/last owner/i);
  });

  it("lists members when permission is granted", async () => {
    const owner = await registerLoginAndCreateWorkspace();
    const response = await request(owner.app)
      .get(`/api/v1/workspaces/${owner.workspaceId}/members`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBe(1);
  });

  it("invites a member and accepts invitation for a new user", async () => {
    const owner = await registerLoginAndCreateWorkspace({
      type: "ORGANIZATION",
    });
    const inviteEmail = `member-${Date.now()}@example.com`;

    const invite = await request(owner.app)
      .post(`/api/v1/workspaces/${owner.workspaceId}/invitations`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ email: inviteEmail, roleKey: "member" });

    expect(invite.status).toBe(201);

    const invitation = await prisma.workspaceInvitation.findFirst({
      where: {
        workspaceId: owner.workspaceId!,
        email: inviteEmail,
        status: "PENDING",
      },
    });
    expect(invitation).toBeTruthy();

    const raw = "invite-token-for-test";
    const { hashToken } = await import("../src/lib/tokens.js");
    await prisma.workspaceInvitation.update({
      where: { id: invitation!.id },
      data: { tokenHash: hashToken(raw) },
    });

    const accept = await request(owner.app)
      .post("/api/v1/invitations/accept")
      .send({
        token: raw,
        fullName: "Invited Member",
        password: "Password123",
        confirmPassword: "Password123",
      });

    expect(accept.status).toBe(200);
    expect(accept.body.data.workspaceId).toBe(owner.workspaceId);

    const onboarding = await prisma.workspaceOnboarding.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: owner.workspaceId!,
          userId: accept.body.data.userId,
        },
      },
    });
    expect(onboarding?.onboardingType).toBe("INVITED_MEMBER");
    expect(onboarding?.status).toBe("IN_PROGRESS");
  });
});

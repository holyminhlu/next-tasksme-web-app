import request from "supertest";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/config/database.js";
import { registerAndLogin } from "./helpers.js";

describe("tenant isolation and owner rules", () => {
  it("allows members to read their own company and blocks cross-company access", async () => {
    const companyA = await registerAndLogin({
      email: `owner-a-${Date.now()}@example.com`,
      companyName: `Company A ${Date.now()}`,
    });
    const companyB = await registerAndLogin({
      email: `owner-b-${Date.now()}@example.com`,
      companyName: `Company B ${Date.now()}`,
    });

    const own = await request(companyA.app)
      .get(`/api/v1/companies/${companyA.companyId}`)
      .set("Authorization", `Bearer ${companyA.accessToken}`);
    expect(own.status).toBe(200);

    const cross = await request(companyA.app)
      .get(`/api/v1/companies/${companyB.companyId}`)
      .set("Authorization", `Bearer ${companyA.accessToken}`);
    expect(cross.status).toBe(403);
  });

  it("prevents demoting the last owner", async () => {
    const owner = await registerAndLogin();
    const membership = await prisma.companyMember.findFirst({
      where: {
        companyId: owner.companyId!,
        userId: owner.userId!,
      },
    });

    const response = await request(owner.app)
      .patch(`/api/v1/companies/${owner.companyId}/members/${membership!.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ roleKey: "admin" });

    expect(response.status).toBe(403);
    expect(response.body.error.message).toMatch(/last owner/i);
  });

  it("lists members when permission is granted", async () => {
    const owner = await registerAndLogin();
    const response = await request(owner.app)
      .get(`/api/v1/companies/${owner.companyId}/members`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBe(1);
  });

  it("invites a member and accepts invitation for a new user", async () => {
    const owner = await registerAndLogin();
    const inviteEmail = `member-${Date.now()}@example.com`;

    const invite = await request(owner.app)
      .post(`/api/v1/companies/${owner.companyId}/invitations`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ email: inviteEmail, roleKey: "member" });

    expect(invite.status).toBe(201);

    const invitation = await prisma.companyInvitation.findFirst({
      where: {
        companyId: owner.companyId!,
        email: inviteEmail,
        status: "PENDING",
      },
    });
    expect(invitation).toBeTruthy();

    // Replace hash with a known token for accept flow.
    const raw = "invite-token-for-test";
    const { hashToken } = await import("../src/lib/tokens.js");
    await prisma.companyInvitation.update({
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
    expect(accept.body.data.companyId).toBe(owner.companyId);
  });
});

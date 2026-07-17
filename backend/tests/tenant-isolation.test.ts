import request from "supertest";
import { describe, expect, it } from "vitest";
import { registerUser } from "./helpers.js";

describe("tenant isolation and permissions", () => {
  it("allows members to read their own company", async () => {
    const { app, accessToken, companyId } = await registerUser({
      email: `owner-a-${Date.now()}@example.com`,
      companyName: `Company A ${Date.now()}`,
    });

    const response = await request(app)
      .get(`/api/v1/companies/${companyId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(companyId);
  });

  it("blocks cross-company access", async () => {
    const companyA = await registerUser({
      email: `owner-a-${Date.now()}@example.com`,
      companyName: `Company A ${Date.now()}`,
    });
    const companyB = await registerUser({
      email: `owner-b-${Date.now()}@example.com`,
      companyName: `Company B ${Date.now()}`,
    });

    const response = await request(companyA.app)
      .get(`/api/v1/companies/${companyB.companyId}`)
      .set("Authorization", `Bearer ${companyA.accessToken}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("requires authentication for company endpoints", async () => {
    const company = await registerUser();
    const response = await request(company.app).get(
      `/api/v1/companies/${company.companyId}`,
    );

    expect(response.status).toBe(401);
  });

  it("lists members when permission is granted", async () => {
    const { app, accessToken, companyId } = await registerUser();

    const response = await request(app)
      .get(`/api/v1/companies/${companyId}/members`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBe(1);
    expect(response.body.meta.pagination.total).toBe(1);
  });
});

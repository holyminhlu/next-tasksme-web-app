import { describe, expect, it } from "vitest";
import {
  buildCreateWorkspacePayload,
  normalizeTaskTitles,
  validateFirstProject,
  validateInviteEmail,
  validateOrganizationProfile,
  validateUsagePurpose,
  validateUsageType,
  validateWorkspaceName,
} from "./validation";

describe("usage type step logic", () => {
  it("requires a usage type selection", () => {
    expect(validateUsageType({ type: null })).toBe(
      "Vui lòng chọn hình thức sử dụng",
    );
    expect(validateUsageType({ type: "PERSONAL" })).toBeNull();
    expect(validateUsageType({ type: "ORGANIZATION" })).toBeNull();
  });

  it("builds the create-workspace payload for the chosen type", () => {
    expect(buildCreateWorkspacePayload("PERSONAL")).toEqual({
      type: "PERSONAL",
      timezone: "Asia/Ho_Chi_Minh",
      locale: "vi",
    });
    expect(buildCreateWorkspacePayload("ORGANIZATION").type).toBe(
      "ORGANIZATION",
    );
  });
});

describe("onboarding validation", () => {
  it("validates workspace names", () => {
    expect(validateWorkspaceName("A")).not.toBeNull();
    expect(validateWorkspaceName("  Xưởng của Minh  ")).toBeNull();
    expect(validateWorkspaceName("x".repeat(121))).not.toBeNull();
  });

  it("requires a usage purpose", () => {
    expect(validateUsagePurpose("")).not.toBeNull();
    expect(validateUsagePurpose("work")).toBeNull();
  });

  it("validates the organization profile step by step", () => {
    const valid = {
      name: "Công ty ABC",
      industryCode: "retail",
      companySize: "6-20",
      timezone: "Asia/Ho_Chi_Minh",
      locale: "vi",
    };

    expect(validateOrganizationProfile(valid)).toBeNull();
    expect(
      validateOrganizationProfile({ ...valid, name: "A" }),
    ).not.toBeNull();
    expect(
      validateOrganizationProfile({ ...valid, industryCode: "" }),
    ).toBe("Vui lòng chọn lĩnh vực hoạt động");
    expect(
      validateOrganizationProfile({ ...valid, companySize: "" }),
    ).toBe("Vui lòng chọn quy mô công ty");
  });

  it("validates the first project", () => {
    expect(
      validateFirstProject({ name: "P", taskTitles: [] }),
    ).not.toBeNull();
    expect(
      validateFirstProject({ name: "Dự án đầu tiên", taskTitles: ["", "A"] }),
    ).toBeNull();
    expect(
      validateFirstProject({
        name: "Dự án",
        taskTitles: Array.from({ length: 21 }, (_, i) => `Task ${i}`),
      }),
    ).not.toBeNull();
  });

  it("normalizes task titles by trimming and dropping empties", () => {
    expect(normalizeTaskTitles(["  A  ", "", "  ", "B"])).toEqual(["A", "B"]);
  });

  it("validates invite emails", () => {
    expect(validateInviteEmail("not-an-email")).not.toBeNull();
    expect(validateInviteEmail("a@b.vn")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { hasPermission, permissionsForRole } from "./permissions";

describe("permissions", () => {
  it("maps owner role to ownership transfer permission", () => {
    const permissions = permissionsForRole("owner");
    expect(hasPermission(permissions, "ownership:transfer")).toBe(true);
    expect(hasPermission(permissions, "members:invite")).toBe(true);
  });

  it("does not grant ownership transfer to admin or member", () => {
    expect(hasPermission(permissionsForRole("admin"), "ownership:transfer")).toBe(
      false,
    );
    expect(hasPermission(permissionsForRole("member"), "members:invite")).toBe(
      false,
    );
  });

  it("requires every permission when given an array", () => {
    const permissions = permissionsForRole("manager");
    expect(
      hasPermission(permissions, ["members:read", "members:invite"]),
    ).toBe(true);
    expect(
      hasPermission(permissions, ["members:read", "ownership:transfer"]),
    ).toBe(false);
  });
});

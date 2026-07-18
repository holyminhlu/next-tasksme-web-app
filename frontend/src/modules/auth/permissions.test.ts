import { describe, expect, it } from "vitest";
import { hasPermission, permissionsForRole } from "./permissions";

describe("permissions", () => {
  it("maps owner role to ownership transfer and module management", () => {
    const permissions = permissionsForRole("owner");
    expect(hasPermission(permissions, "ownership:transfer")).toBe(true);
    expect(hasPermission(permissions, "members:invite")).toBe(true);
    expect(hasPermission(permissions, "modules:manage")).toBe(true);
    expect(hasPermission(permissions, "projects:create")).toBe(true);
  });

  it("does not grant ownership transfer to admin, nor invites to member", () => {
    expect(hasPermission(permissionsForRole("admin"), "ownership:transfer")).toBe(
      false,
    );
    expect(hasPermission(permissionsForRole("member"), "members:invite")).toBe(
      false,
    );
  });

  it("grants admin module management but not manager", () => {
    expect(hasPermission(permissionsForRole("admin"), "modules:manage")).toBe(
      true,
    );
    expect(hasPermission(permissionsForRole("manager"), "modules:manage")).toBe(
      false,
    );
  });

  it("lets managers create projects but members only read them", () => {
    expect(hasPermission(permissionsForRole("manager"), "projects:create")).toBe(
      true,
    );
    expect(hasPermission(permissionsForRole("member"), "projects:create")).toBe(
      false,
    );
    expect(hasPermission(permissionsForRole("member"), "projects:read")).toBe(
      true,
    );
  });

  it("grants tasks:assign to all roles (members self-assign only in the service)", () => {
    expect(hasPermission(permissionsForRole("owner"), "tasks:assign")).toBe(true);
    expect(hasPermission(permissionsForRole("admin"), "tasks:assign")).toBe(true);
    expect(hasPermission(permissionsForRole("manager"), "tasks:assign")).toBe(
      true,
    );
    expect(hasPermission(permissionsForRole("member"), "tasks:assign")).toBe(
      true,
    );
  });

  it("grants collaboration permissions with member restrictions", () => {
    expect(hasPermission(permissionsForRole("member"), "comment.create")).toBe(
      true,
    );
    expect(hasPermission(permissionsForRole("member"), "checklist.manage")).toBe(
      true,
    );
    expect(hasPermission(permissionsForRole("member"), "tag.delete")).toBe(false);
    expect(
      hasPermission(permissionsForRole("member"), "custom_field.configure"),
    ).toBe(false);
    expect(hasPermission(permissionsForRole("manager"), "tag.delete")).toBe(true);
    expect(
      hasPermission(permissionsForRole("admin"), "attachment.manage"),
    ).toBe(true);
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

  it("returns no permissions for unknown roles", () => {
    expect(permissionsForRole("ghost")).toEqual([]);
  });
});

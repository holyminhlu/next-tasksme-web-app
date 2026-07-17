import { describe, expect, it } from "vitest";
import { permissionsForRole } from "@/modules/auth/permissions";
import { buildCommands, filterCommands } from "./commands";
import type { NavContext } from "./navigation";

function context(overrides: Partial<NavContext> = {}): NavContext {
  return {
    workspaceType: "ORGANIZATION",
    permissions: permissionsForRole("owner"),
    enabledModuleKeys: null,
    ...overrides,
  };
}

describe("buildCommands", () => {
  it("includes navigation commands for visible routes only", () => {
    const memberCommands = buildCommands(
      context({
        permissions: permissionsForRole("member"),
        enabledModuleKeys: ["tasks"],
      }),
    ).map((command) => command.id);

    expect(memberCommands).toContain("nav-dashboard");
    expect(memberCommands).toContain("nav-my-tasks");
    // projects module disabled above.
    expect(memberCommands).not.toContain("nav-projects");
    expect(memberCommands).not.toContain("nav-settings-danger");
  });

  it("filters action commands by permission", () => {
    const memberCommands = buildCommands(
      context({ permissions: permissionsForRole("member") }),
    ).map((command) => command.id);

    expect(memberCommands).toContain("action-create-task");
    expect(memberCommands).not.toContain("action-create-project");
    expect(memberCommands).not.toContain("action-invite-member");
  });

  it("filters create actions when modules are disabled", () => {
    const commands = buildCommands(
      context({ enabledModuleKeys: ["projects"] }),
    ).map((command) => command.id);

    expect(commands).not.toContain("action-create-task");
    expect(commands).toContain("action-create-project");
  });

  it("filters action commands by workspace type", () => {
    const personalOwner = buildCommands(
      context({ workspaceType: "PERSONAL" }),
    ).map((command) => command.id);

    expect(personalOwner).not.toContain("action-invite-member");
    expect(personalOwner).toContain("action-create-project");
  });

  it("always includes preference commands", () => {
    const commands = buildCommands(
      context({ permissions: [] }),
    ).map((command) => command.id);

    expect(commands).toContain("pref-toggle-focus");
    expect(commands).toContain("pref-theme-dark");
  });
});

describe("filterCommands", () => {
  const commands = buildCommands(context());

  it("returns everything for an empty query", () => {
    expect(filterCommands(commands, "")).toHaveLength(commands.length);
    expect(filterCommands(commands, "   ")).toHaveLength(commands.length);
  });

  it("matches case-insensitively against labels", () => {
    const results = filterCommands(commands, "DASHBOARD");
    expect(results.some((command) => command.id === "nav-dashboard")).toBe(true);
  });

  it("matches keywords", () => {
    const results = filterCommands(commands, "zen");
    expect(results.map((command) => command.id)).toContain("pref-toggle-focus");
  });

  it("requires every token to match", () => {
    const results = filterCommands(commands, "theme dark");
    expect(results.map((command) => command.id)).toEqual(["pref-theme-dark"]);
  });

  it("returns empty for nonsense queries", () => {
    expect(filterCommands(commands, "xyzzy quux")).toEqual([]);
  });
});

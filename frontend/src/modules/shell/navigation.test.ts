import { describe, expect, it } from "vitest";
import { permissionsForRole } from "@/modules/auth/permissions";
import {
  APP_ROUTES,
  breadcrumbTrail,
  findRouteByPath,
  isRouteVisible,
  mobileNavRoutes,
  settingsRoutes,
  sidebarRoutes,
  visibleRoutes,
  type NavContext,
} from "./navigation";

function context(overrides: Partial<NavContext> = {}): NavContext {
  return {
    workspaceType: "ORGANIZATION",
    permissions: permissionsForRole("owner"),
    enabledModuleKeys: null,
    ...overrides,
  };
}

describe("route config", () => {
  it("has unique ids and hrefs", () => {
    const ids = APP_ROUTES.map((route) => route.id);
    const hrefs = APP_ROUTES.map((route) => route.href);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("covers the core Phase 3 destinations", () => {
    const hrefs = APP_ROUTES.map((route) => route.href);

    for (const expected of [
      "/dashboard",
      "/my-tasks",
      "/projects",
      "/notifications",
      "/settings",
    ]) {
      expect(hrefs).toContain(expected);
    }
  });
});

describe("permission filtering", () => {
  it("shows admin-only settings routes to owners but not members", () => {
    const ownerRoutes = visibleRoutes(context()).map((route) => route.id);
    const memberRoutes = visibleRoutes(
      context({ permissions: permissionsForRole("member") }),
    ).map((route) => route.id);

    expect(ownerRoutes).toContain("settings-danger");
    expect(ownerRoutes).toContain("settings-members");
    expect(memberRoutes).not.toContain("settings-danger");
    // Members can read the member list.
    expect(memberRoutes).toContain("settings-members");
  });

  it("hides everything permission-gated for an unknown role", () => {
    const routes = visibleRoutes(
      context({ permissions: permissionsForRole("mystery-role") }),
    ).map((route) => route.id);

    expect(routes).toContain("dashboard");
    expect(routes).toContain("settings");
    expect(routes).not.toContain("my-tasks");
    expect(routes).not.toContain("settings-workspace");
  });
});

describe("workspace type filtering", () => {
  it("hides organization-only routes in personal workspaces", () => {
    const personal = visibleRoutes(
      context({ workspaceType: "PERSONAL" }),
    ).map((route) => route.id);

    expect(personal).not.toContain("settings-members");
    expect(personal).not.toContain("settings-roles");
    expect(personal).toContain("dashboard");
  });

  it("skips type filtering when workspace type is unknown", () => {
    const route = APP_ROUTES.find((entry) => entry.id === "settings-roles")!;

    expect(
      isRouteVisible(route, context({ workspaceType: null })),
    ).toBe(true);
  });
});

describe("module filtering", () => {
  it("hides module-gated routes when the module is disabled", () => {
    const routes = visibleRoutes(
      context({ enabledModuleKeys: ["tasks", "members"] }),
    ).map((route) => route.id);

    expect(routes).toContain("my-tasks");
    expect(routes).not.toContain("projects");
    expect(routes).toContain("settings-members");
  });

  it("degrades safely when module info has not loaded (null)", () => {
    const routes = visibleRoutes(
      context({ enabledModuleKeys: null }),
    ).map((route) => route.id);

    expect(routes).toContain("my-tasks");
    expect(routes).toContain("projects");
  });
});

describe("derived nav lists", () => {
  it("sidebar and mobile nav only include flagged routes", () => {
    const ctx = context();

    for (const route of sidebarRoutes(ctx)) {
      expect(route.showInSidebar).toBe(true);
    }

    for (const route of mobileNavRoutes(ctx)) {
      expect(route.showInMobileNav).toBe(true);
    }
  });

  it("settings navigation only lists settings children", () => {
    for (const route of settingsRoutes(context())) {
      expect(route.section).toBe("settings");
      expect(route.parentId).toBe("settings");
    }
  });
});

describe("path matching and breadcrumbs", () => {
  it("matches exact and nested paths with longest prefix", () => {
    expect(findRouteByPath("/dashboard")?.id).toBe("dashboard");
    expect(findRouteByPath("/settings/security")?.id).toBe("settings-security");
    expect(findRouteByPath("/settings")?.id).toBe("settings");
    expect(findRouteByPath("/nowhere")).toBeUndefined();
  });

  it("does not match sibling prefixes without a separator", () => {
    expect(findRouteByPath("/settingsfoo")).toBeUndefined();
  });

  it("builds parent-first breadcrumb trails", () => {
    expect(breadcrumbTrail("/settings/members").map((route) => route.id)).toEqual(
      ["settings", "settings-members"],
    );
    expect(breadcrumbTrail("/dashboard").map((route) => route.id)).toEqual([
      "dashboard",
    ]);
    expect(breadcrumbTrail("/unknown")).toEqual([]);
  });
});

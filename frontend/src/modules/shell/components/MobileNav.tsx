"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Menu } from "lucide-react";
import { Drawer } from "@/modules/design-system";
import {
  mobileNavRoutes,
  sidebarRoutes,
  type RouteMeta,
} from "../navigation";
import { useShell } from "../ShellProvider";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import styles from "./MobileNav.module.css";

function isRouteActive(pathname: string, route: RouteMeta): boolean {
  return pathname === route.href || pathname.startsWith(`${route.href}/`);
}

/** Fixed bottom navigation for phones: top destinations plus a Menu button. */
export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { navContext, setMobileNavOpen } = useShell();

  const routes = mobileNavRoutes(navContext).slice(0, 4);

  return (
    <nav className={styles.bottomNav} aria-label="Quick navigation">
      {routes.map((route) => {
        const Icon = route.icon;
        const active = isRouteActive(pathname, route);

        return (
          <button
            key={route.id}
            type="button"
            className={`${styles.bottomItem} ${active ? styles.bottomItemActive : ""}`.trim()}
            aria-current={active ? "page" : undefined}
            onClick={() => router.push(route.href)}
          >
            <Icon size={19} aria-hidden />
            {route.label}
          </button>
        );
      })}
      <button
        type="button"
        className={styles.bottomItem}
        onClick={() => setMobileNavOpen(true)}
      >
        <Menu size={19} aria-hidden />
        Menu
      </button>
    </nav>
  );
}

/** Full navigation drawer for mobile/tablet, mirroring the sidebar. */
export function MobileNavDrawer() {
  const pathname = usePathname();
  const {
    navContext,
    mobileNavOpen,
    setMobileNavOpen,
    pinnedNavIds,
    setNotificationsOpen,
    unreadNotificationCount,
  } = useShell();

  const routes = sidebarRoutes(navContext);
  const pinnedRoutes = routes.filter((route) => pinnedNavIds.includes(route.id));
  const otherRoutes = routes.filter((route) => !pinnedNavIds.includes(route.id));

  function renderItem(route: RouteMeta) {
    const Icon = route.icon;
    const active = isRouteActive(pathname, route);

    return (
      <Link
        key={route.id}
        href={route.href}
        className={`${styles.drawerItem} ${active ? styles.drawerItemActive : ""}`.trim()}
        aria-current={active ? "page" : undefined}
        onClick={() => setMobileNavOpen(false)}
      >
        <Icon size={18} aria-hidden />
        {route.label}
      </Link>
    );
  }

  return (
    <Drawer
      open={mobileNavOpen}
      onClose={() => setMobileNavOpen(false)}
      title="Navigation"
      side="left"
    >
      <div className={styles.drawerNav}>
        <div className={styles.workspaceBlock}>
          <WorkspaceSwitcher collapsed={false} />
        </div>

        {pinnedRoutes.length > 0 && (
          <div className={styles.drawerSection}>
            <p className={styles.drawerSectionTitle}>Pinned</p>
            {pinnedRoutes.map(renderItem)}
          </div>
        )}

        <div className={styles.drawerSection}>
          <p className={styles.drawerSectionTitle}>Menu</p>
          {otherRoutes.map(renderItem)}
          <button
            type="button"
            className={styles.drawerItem}
            onClick={() => {
              setMobileNavOpen(false);
              setNotificationsOpen(true);
            }}
          >
            <Bell size={18} aria-hidden />
            Notifications
            {unreadNotificationCount > 0 &&
              ` (${unreadNotificationCount})`}
          </button>
        </div>
      </div>
    </Drawer>
  );
}

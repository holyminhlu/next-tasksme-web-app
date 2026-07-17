"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Focus, PanelLeftClose, PanelLeftOpen, Pin, PinOff } from "lucide-react";
import { IconButton, Tooltip } from "@/modules/design-system";
import {
  findRouteById,
  sidebarRoutes,
  type RouteMeta,
} from "../navigation";
import { useShell } from "../ShellProvider";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import styles from "./Sidebar.module.css";

function isRouteActive(pathname: string, route: RouteMeta): boolean {
  return pathname === route.href || pathname.startsWith(`${route.href}/`);
}

function NavItem({
  route,
  collapsed,
  pinned,
  onTogglePin,
}: {
  route: RouteMeta;
  collapsed: boolean;
  pinned: boolean;
  onTogglePin?: () => void;
}) {
  const pathname = usePathname();
  const active = isRouteActive(pathname, route);
  const Icon = route.icon;

  const link = (
    <Link
      href={route.href}
      className={`${styles.item} ${active ? styles.itemActive : ""}`.trim()}
      aria-current={active ? "page" : undefined}
    >
      <span className={styles.itemIcon} aria-hidden>
        <Icon size={18} />
      </span>
      <span className={styles.itemLabel}>{route.label}</span>
    </Link>
  );

  return (
    <div className={styles.itemRow}>
      {collapsed ? (
        <Tooltip content={route.label} side="right">
          {link}
        </Tooltip>
      ) : (
        link
      )}
      {!collapsed && onTogglePin && (
        <IconButton
          size="sm"
          className={styles.pinButton}
          aria-label={pinned ? `Unpin ${route.label}` : `Pin ${route.label}`}
          aria-pressed={pinned}
          onClick={onTogglePin}
        >
          {pinned ? <PinOff size={14} /> : <Pin size={14} />}
        </IconButton>
      )}
    </div>
  );
}

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const {
    navContext,
    pinnedNavIds,
    recentNavIds,
    togglePinned,
    sidebarCollapsed,
    toggleSidebar,
    toggleFocusMode,
  } = useShell();

  const routes = sidebarRoutes(navContext);
  const routeIds = new Set(routes.map((route) => route.id));

  const pinnedRoutes = pinnedNavIds
    .map((id) => routes.find((route) => route.id === id))
    .filter((route): route is RouteMeta => Boolean(route));

  const mainRoutes = routes.filter((route) => !pinnedNavIds.includes(route.id));

  const recentRoutes = recentNavIds
    .map((id) => findRouteById(id))
    .filter(
      (route): route is RouteMeta =>
        Boolean(route) && routeIds.has(route!.id) && !pinnedNavIds.includes(route!.id),
    )
    .slice(0, 3);

  return (
    <aside
      className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`.trim()}
      aria-label="Primary"
    >
      <div className={styles.header}>
        <WorkspaceSwitcher collapsed={collapsed} />
      </div>

      <nav className={styles.nav} aria-label="Main navigation">
        {pinnedRoutes.length > 0 && (
          <div className={styles.section}>
            <p className={styles.sectionTitle}>Pinned</p>
            {pinnedRoutes.map((route) => (
              <NavItem
                key={route.id}
                route={route}
                collapsed={collapsed}
                pinned
                onTogglePin={
                  route.pinnable ? () => togglePinned(route.id) : undefined
                }
              />
            ))}
          </div>
        )}

        <div className={styles.section}>
          <p className={styles.sectionTitle}>Menu</p>
          {mainRoutes.map((route) => (
            <NavItem
              key={route.id}
              route={route}
              collapsed={collapsed}
              pinned={false}
              onTogglePin={
                route.pinnable ? () => togglePinned(route.id) : undefined
              }
            />
          ))}
        </div>

        {!collapsed && recentRoutes.length > 0 && (
          <div className={styles.section}>
            <p className={styles.sectionTitle}>Recent</p>
            {recentRoutes.map((route) => (
              <NavItem
                key={`recent-${route.id}`}
                route={route}
                collapsed={collapsed}
                pinned={false}
              />
            ))}
          </div>
        )}
      </nav>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.footerButton}
          onClick={toggleFocusMode}
          title="Focus mode (Ctrl+Shift+F)"
        >
          <Focus size={18} aria-hidden />
          <span className={styles.footerLabel}>Focus mode</span>
        </button>
        <button
          type="button"
          className={styles.footerButton}
          onClick={toggleSidebar}
          aria-pressed={sidebarCollapsed}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen size={18} aria-hidden />
          ) : (
            <PanelLeftClose size={18} aria-hidden />
          )}
          <span className={styles.footerLabel}>
            {sidebarCollapsed ? "Expand" : "Collapse"}
          </span>
        </button>
      </div>
    </aside>
  );
}

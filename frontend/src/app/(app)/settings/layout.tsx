"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageHeader, settingsRoutes, useShell } from "@/modules/shell";
import styles from "../app-pages.module.css";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { navContext } = useShell();

  const routes = settingsRoutes(navContext);

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your account and workspace configuration."
      />
      <div className={styles.settingsLayout}>
        <nav aria-label="Settings sections" className={styles.settingsNav}>
          {routes.map((route) => {
            const Icon = route.icon;
            const active =
              pathname === route.href || pathname.startsWith(`${route.href}/`);
            const classes = [
              styles.settingsNavLink,
              active ? styles.settingsNavLinkActive : "",
              route.id === "settings-danger" && !active
                ? styles.settingsNavLinkDanger
                : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <Link
                key={route.id}
                href={route.href}
                className={classes}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={16} aria-hidden />
                {route.label}
              </Link>
            );
          })}
        </nav>
        <div className={styles.settingsContent}>{children}</div>
      </div>
    </div>
  );
}

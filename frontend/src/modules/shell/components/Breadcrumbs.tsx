"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { ChevronRight } from "lucide-react";
import { breadcrumbTrail } from "../navigation";
import styles from "./TopBar.module.css";

export function Breadcrumbs() {
  const pathname = usePathname();
  const trail = breadcrumbTrail(pathname);

  if (trail.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className={styles.breadcrumbs}>
      <ol className={styles.breadcrumbList}>
        {trail.map((route, index) => {
          const isLast = index === trail.length - 1;

          return (
            <Fragment key={route.id}>
              <li className={styles.breadcrumbItem}>
                {isLast ? (
                  <span aria-current="page" className={styles.breadcrumbCurrent}>
                    {route.label}
                  </span>
                ) : (
                  <Link href={route.href} className={styles.breadcrumbLink}>
                    {route.label}
                  </Link>
                )}
              </li>
              {!isLast && (
                <li aria-hidden className={styles.breadcrumbSeparator}>
                  <ChevronRight size={14} />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

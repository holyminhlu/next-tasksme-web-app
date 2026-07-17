import type { ReactNode } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import styles from "./status-screen.module.css";

type StatusScreenProps = {
  icon: ReactNode;
  tone?: "info" | "danger";
  title: string;
  description: string;
  meta?: ReactNode;
  actions?: ReactNode;
  showLogo?: boolean;
};

/**
 * Self-contained full-page status layout for error boundaries, not-found,
 * offline and maintenance states. Deliberately does not depend on globals.css
 * so it also renders correctly inside the global error boundary.
 */
export function StatusScreen({
  icon,
  tone = "info",
  title,
  description,
  meta,
  actions,
  showLogo = true,
}: StatusScreenProps) {
  const iconClass =
    tone === "danger"
      ? `${styles.iconWrap} ${styles.iconWrapDanger}`
      : styles.iconWrap;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        {showLogo && <BrandLogo size="default" priority />}
        <section className={styles.card} aria-labelledby="status-title">
          <span className={iconClass} aria-hidden="true">
            {icon}
          </span>
          <h1 id="status-title" className={styles.title}>
            {title}
          </h1>
          <p className={styles.description}>{description}</p>
          {meta && <p className={styles.meta}>{meta}</p>}
          {actions && <div className={styles.actions}>{actions}</div>}
        </section>
      </div>
    </main>
  );
}

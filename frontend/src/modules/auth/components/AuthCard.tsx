import type { ReactNode } from "react";
import styles from "../auth.module.css";

type AuthCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div>
          <p className={styles.eyebrow}>TaskMng SME</p>
        </div>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h1>{title}</h1>
            {description && <p>{description}</p>}
          </div>
          {children}
        </section>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}

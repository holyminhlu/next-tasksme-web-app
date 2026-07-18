import type { ReactNode } from "react";
import { BrandLogo } from "@/components/BrandLogo";
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
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <BrandLogo size="compact" priority className={styles.cardLogo} />
            <div className={styles.cardHeading}>
              <h1>{title}</h1>
              {description ? <p>{description}</p> : null}
            </div>
          </div>
          {children}
        </section>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>
  );
}

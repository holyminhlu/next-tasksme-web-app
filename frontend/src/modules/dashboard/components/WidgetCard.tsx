"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { ErrorState, Skeleton } from "@/modules/design-system";
import type { WidgetError } from "../useWidget";
import styles from "./widgets.module.css";

/**
 * Shared frame for dashboard widgets: each widget owns its loading, error
 * and retry state so one failing endpoint never blanks the whole page.
 */
export function WidgetCard({
  title,
  description,
  actions,
  loading,
  refreshing = false,
  error,
  onRetry,
  skeletonRows = 3,
  labelledBy,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  loading: boolean;
  refreshing?: boolean;
  error: WidgetError | null;
  onRetry: () => void;
  skeletonRows?: number;
  labelledBy: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.widget} aria-labelledby={labelledBy}>
      <div className={styles.widgetHeader}>
        <div className={styles.widgetTitleBlock}>
          <h2 id={labelledBy} className={styles.widgetTitle}>
            {title}
            {refreshing && (
              <span className={styles.widgetRefreshing}>
                <Loader2 size={12} aria-hidden />
                <span>Refreshing…</span>
              </span>
            )}
          </h2>
          {description && (
            <p className={styles.widgetDescription}>{description}</p>
          )}
        </div>
        {actions && <div className={styles.widgetActions}>{actions}</div>}
      </div>

      <div className={styles.widgetBody}>
        {loading ? (
          <div className={styles.skeletonRows} aria-hidden>
            {Array.from({ length: skeletonRows }, (_, index) => (
              <Skeleton key={index} height={22} />
            ))}
          </div>
        ) : error ? (
          <ErrorState
            plain
            title="Couldn't load this section"
            description={error.message}
            onRetry={onRetry}
          />
        ) : (
          children
        )}
      </div>
    </section>
  );
}

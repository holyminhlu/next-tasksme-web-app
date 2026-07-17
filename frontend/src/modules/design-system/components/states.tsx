"use client";

import type { ReactNode } from "react";
import {
  AlertTriangle,
  Inbox,
  Loader2,
  Lock,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { Button } from "./Button";
import styles from "./states.module.css";

type StateTone = "neutral" | "danger" | "warning";

type BaseStateProps = {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  tone?: StateTone;
  /** Render without the dashed card frame (for use inside existing cards). */
  plain?: boolean;
  className?: string;
};

function StateFrame({
  icon,
  title,
  description,
  actions,
  tone = "neutral",
  plain = false,
  className = "",
}: BaseStateProps) {
  const iconClass = [
    styles.icon,
    tone === "danger" ? styles.iconDanger : "",
    tone === "warning" ? styles.iconWarning : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={`${styles.state} ${plain ? styles.plain : ""} ${className}`.trim()}
    >
      {icon && (
        <span className={iconClass} aria-hidden>
          {icon}
        </span>
      )}
      <p className={styles.title}>{title}</p>
      {description && <div className={styles.description}>{description}</div>}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

export type EmptyStateProps = Omit<BaseStateProps, "tone">;

export function EmptyState({ icon, ...rest }: EmptyStateProps) {
  return <StateFrame icon={icon ?? <Inbox size={22} />} {...rest} />;
}

export type ErrorStateProps = Omit<BaseStateProps, "tone" | "actions"> & {
  onRetry?: () => void;
  retryLabel?: string;
  actions?: ReactNode;
};

export function ErrorState({
  icon,
  title,
  description,
  onRetry,
  retryLabel = "Try again",
  actions,
  ...rest
}: ErrorStateProps) {
  return (
    <StateFrame
      tone="danger"
      icon={icon ?? <AlertTriangle size={22} />}
      title={title}
      description={description}
      actions={
        onRetry || actions ? (
          <>
            {onRetry && (
              <Button variant="secondary" onClick={onRetry}>
                {retryLabel}
              </Button>
            )}
            {actions}
          </>
        ) : undefined
      }
      {...rest}
    />
  );
}

export function LoadingState({
  label = "Loading...",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`${styles.loading} ${className}`.trim()}
    >
      <Loader2 size={22} aria-hidden className={styles.spinner} />
      <span>{label}</span>
    </div>
  );
}

export function UnauthorizedState({ actions }: { actions?: ReactNode }) {
  return (
    <StateFrame
      tone="warning"
      icon={<Lock size={22} />}
      title="You need to sign in"
      description="Your session is missing or has expired. Sign in again to continue."
      actions={actions}
    />
  );
}

export function ForbiddenState({
  description = "You don't have permission to view this page in the current workspace. Ask a workspace admin if you believe this is a mistake.",
  actions,
}: {
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <StateFrame
      tone="danger"
      icon={<ShieldAlert size={22} />}
      title="Access denied"
      description={description}
      actions={actions}
    />
  );
}

export function MaintenanceState({
  description = "This area is temporarily unavailable while we perform maintenance. Please check back soon.",
  actions,
}: {
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <StateFrame
      tone="warning"
      icon={<Wrench size={22} />}
      title="Under maintenance"
      description={description}
      actions={actions}
    />
  );
}

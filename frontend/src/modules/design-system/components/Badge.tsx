import type { HTMLAttributes } from "react";
import styles from "./Badge.module.css";

export type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  withDot?: boolean;
};

export function Badge({
  tone = "neutral",
  withDot = false,
  className = "",
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={`${styles.badge} ${styles[tone]} ${className}`.trim()}
      {...rest}
    >
      {withDot && <span className={styles.dot} aria-hidden />}
      {children}
    </span>
  );
}

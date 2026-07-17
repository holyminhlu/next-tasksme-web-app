"use client";

import { useId, useState, type ReactNode } from "react";
import styles from "./Tooltip.module.css";

export type TooltipProps = {
  content: string;
  side?: "top" | "bottom" | "right";
  /** Hide the tooltip entirely (e.g. when labels are already visible). */
  disabled?: boolean;
  children: ReactNode;
  className?: string;
};

/**
 * Lightweight tooltip shown on hover and keyboard focus. The content is also
 * exposed to assistive tech through aria-describedby while visible.
 */
export function Tooltip({
  content,
  side = "top",
  disabled = false,
  children,
  className = "",
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const shown = visible && !disabled;

  return (
    <span
      className={`${styles.wrapper} ${className}`.trim()}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setVisible(false);
        }
      }}
      aria-describedby={shown ? id : undefined}
    >
      {children}
      {shown && (
        <span role="tooltip" id={id} className={`${styles.bubble} ${styles[side]}`}>
          {content}
        </span>
      )}
    </span>
  );
}

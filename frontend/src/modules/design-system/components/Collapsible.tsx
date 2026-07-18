"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./Collapsible.module.css";

export type CollapsibleProps = {
  title: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
};

export function Collapsible({
  title,
  badge,
  defaultOpen = true,
  children,
  className = "",
}: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section className={`${styles.root} ${className}`.trim()}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={styles.titleRow}>
          <span className={styles.title}>{title}</span>
          {badge}
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`.trim()}
        />
      </button>
      {open && (
        <div id={panelId} className={styles.panel}>
          {children}
        </div>
      )}
    </section>
  );
}

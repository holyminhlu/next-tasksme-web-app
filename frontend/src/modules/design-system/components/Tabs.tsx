"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import styles from "./Tabs.module.css";

export type TabItem = {
  id: string;
  label: ReactNode;
  disabled?: boolean;
};

export type TabsProps = {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  "aria-label": string;
  className?: string;
  /** Prefix used to wire tab/tabpanel ids; pass the same to TabPanel. */
  idPrefix?: string;
};

export function Tabs({
  items,
  value,
  onChange,
  className = "",
  idPrefix = "tabs",
  ...aria
}: TabsProps) {
  const listRef = useRef<HTMLDivElement>(null);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const enabled = items.filter((item) => !item.disabled);
    const currentIndex = enabled.findIndex((item) => item.id === value);

    let nextIndex: number | null = null;

    switch (event.key) {
      case "ArrowRight":
        nextIndex = (currentIndex + 1) % enabled.length;
        break;
      case "ArrowLeft":
        nextIndex = (currentIndex - 1 + enabled.length) % enabled.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = enabled.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const next = enabled[nextIndex];

    if (next) {
      onChange(next.id);
      listRef.current
        ?.querySelector<HTMLElement>(`#${idPrefix}-tab-${next.id}`)
        ?.focus();
    }
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={aria["aria-label"]}
      className={`${styles.tablist} ${className}`.trim()}
      onKeyDown={onKeyDown}
    >
      {items.map((item) => {
        const active = item.id === value;

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${item.id}`}
            aria-selected={active}
            aria-controls={`${idPrefix}-panel-${item.id}`}
            aria-disabled={item.disabled || undefined}
            tabIndex={active ? 0 : -1}
            className={`${styles.tab} ${active ? styles.tabActive : ""}`.trim()}
            onClick={() => !item.disabled && onChange(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  id,
  activeValue,
  idPrefix = "tabs",
  children,
  className = "",
}: {
  id: string;
  activeValue: string;
  idPrefix?: string;
  children: ReactNode;
  className?: string;
}) {
  if (id !== activeValue) {
    return null;
  }

  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${id}`}
      aria-labelledby={`${idPrefix}-tab-${id}`}
      tabIndex={0}
      className={`${styles.panel} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

"use client";

import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { IconButton } from "./Button";
import { useBodyScrollLock, useFocusTrap, useMounted } from "../hooks";
import styles from "./Drawer.module.css";

export type DrawerSize = "md" | "lg" | "xl";

export type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: "left" | "right";
  size?: DrawerSize;
  headerActions?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
};

export function Drawer({
  open,
  onClose,
  title,
  side = "right",
  size = "md",
  headerActions,
  footer,
  children,
}: DrawerProps) {
  const mounted = useMounted();
  const drawerRef = useRef<HTMLDivElement>(null);
  const labelId = useId();

  useFocusTrap(drawerRef, open, onClose);
  useBodyScrollLock(open);

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <>
      <div className={styles.overlay} onMouseDown={onClose} aria-hidden />
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        className={`${styles.drawer} ${styles[side]} ${size !== "md" ? styles[size] : ""}`.trim()}
        tabIndex={-1}
      >
        <div className={styles.header}>
          <h2 id={labelId} className={styles.title}>
            {title}
          </h2>
          <div className={styles.headerActions}>
            {headerActions}
            <IconButton aria-label="Close panel" onClick={onClose}>
              <X size={18} />
            </IconButton>
          </div>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </>,
    document.body,
  );
}

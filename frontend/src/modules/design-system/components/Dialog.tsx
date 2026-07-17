"use client";

import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { IconButton } from "./Button";
import { useBodyScrollLock, useFocusTrap, useMounted } from "../hooks";
import styles from "./Dialog.module.css";

export type DialogSize = "sm" | "md" | "lg";

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  footer?: ReactNode;
  size?: DialogSize;
  children?: ReactNode;
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  footer,
  size = "md",
  children,
}: DialogProps) {
  const mounted = useMounted();
  const dialogRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const descriptionId = useId();

  useFocusTrap(dialogRef, open, onClose);
  useBodyScrollLock(open);

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        aria-describedby={description ? descriptionId : undefined}
        className={`${styles.dialog} ${styles[size]}`}
        tabIndex={-1}
      >
        <div className={styles.header}>
          <div>
            <h2 id={labelId} className={styles.title}>
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className={styles.description}>
                {description}
              </p>
            )}
          </div>
          <IconButton aria-label="Close dialog" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

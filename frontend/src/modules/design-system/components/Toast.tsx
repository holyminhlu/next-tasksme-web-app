"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { IconButton } from "./Button";
import { useMounted } from "../hooks";
import styles from "./Toast.module.css";

export type ToastTone = "info" | "success" | "error";

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Auto-dismiss delay in ms; pass 0 to keep until dismissed. */
  duration?: number;
};

type ToastRecord = ToastInput & { id: number };

type ToastContextValue = {
  toast: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_ICON = {
  success: { Icon: CheckCircle2, className: styles.iconSuccess },
  error: { Icon: AlertCircle, className: styles.iconError },
  info: { Icon: Info, className: styles.iconInfo },
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const nextIdRef = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = nextIdRef.current++;
      const duration = input.duration ?? 5000;

      setToasts((current) => [...current.slice(-3), { ...input, id }]);

      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div className={styles.viewport} role="region" aria-label="Notifications">
            {toasts.map((record) => {
              const tone = record.tone ?? "info";
              const { Icon, className } = TONE_ICON[tone];

              return (
                <div
                  key={record.id}
                  role={tone === "error" ? "alert" : "status"}
                  aria-live={tone === "error" ? "assertive" : "polite"}
                  className={styles.toast}
                >
                  <Icon size={18} aria-hidden className={`${styles.icon} ${className}`} />
                  <div className={styles.content}>
                    <p className={styles.title}>{record.title}</p>
                    {record.description && (
                      <p className={styles.description}>{record.description}</p>
                    )}
                  </div>
                  <IconButton
                    aria-label="Dismiss notification"
                    size="sm"
                    onClick={() => dismiss(record.id)}
                  >
                    <X size={14} />
                  </IconButton>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return context;
}

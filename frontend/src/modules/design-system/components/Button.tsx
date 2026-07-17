"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import styles from "./Button.module.css";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "dangerOutline";

export type ButtonSize = "sm" | "md";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      iconLeft,
      iconRight,
      disabled,
      className = "",
      children,
      type = "button",
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={`${styles.button} ${styles[variant]} ${styles[size]} ${className}`.trim()}
        {...rest}
      >
        {loading ? (
          <Loader2 size={16} aria-hidden className={styles.spinner} />
        ) : (
          iconLeft
        )}
        {children}
        {iconRight}
      </button>
    );
  },
);

export type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "children"
> & {
  /** Accessible name — required because the button renders only an icon. */
  "aria-label": string;
  size?: ButtonSize;
  outline?: boolean;
  active?: boolean;
  children: ReactNode;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      size = "md",
      outline = false,
      active = false,
      className = "",
      children,
      type = "button",
      ...rest
    },
    ref,
  ) {
    const classes = [
      styles.iconButton,
      size === "sm" ? styles.iconButtonSm : styles.iconButtonMd,
      outline ? styles.iconButtonOutline : "",
      active ? styles.iconButtonActive : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button ref={ref} type={type} className={classes} {...rest}>
        {children}
      </button>
    );
  },
);

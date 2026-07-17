"use client";

import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { useFieldIds } from "../hooks";
import styles from "./Form.module.css";

type FieldWrapperProps = {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  id?: string;
  children: (props: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean | undefined;
  }) => ReactNode;
};

export function FormField({
  label,
  hint,
  error,
  required = false,
  id: explicitId,
  children,
}: FieldWrapperProps) {
  const { id, hintId, errorId } = useFieldIds(explicitId);

  const describedBy =
    [hint ? hintId : null, error ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required && (
          <span className={styles.required} aria-hidden>
            *
          </span>
        )}
      </label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput({ invalid = false, className = "", ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={`${styles.input} ${invalid ? styles.inputInvalid : ""} ${className}`.trim()}
        {...rest}
      />
    );
  },
);

export type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  function TextArea({ invalid = false, className = "", ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={`${styles.textarea} ${invalid ? styles.inputInvalid : ""} ${className}`.trim()}
        {...rest}
      />
    );
  },
);

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ invalid = false, className = "", children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={`${styles.select} ${invalid ? styles.inputInvalid : ""} ${className}`.trim()}
        {...rest}
      >
        {children}
      </select>
    );
  },
);

export type CheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  label: ReactNode;
  hint?: ReactNode;
};

export function Checkbox({ label, hint, ...rest }: CheckboxProps) {
  return (
    <label className={styles.checkboxRow}>
      <input type="checkbox" {...rest} />
      <span className={styles.checkboxLabel}>
        {label}
        {hint && <span className={styles.checkboxHint}>{hint}</span>}
      </span>
    </label>
  );
}

export type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: ReactNode;
  disabled?: boolean;
};

export function Switch({ checked, onChange, label, hint, disabled }: SwitchProps) {
  const { id, hintId } = useFieldIds();

  return (
    <div className={styles.switchRow}>
      <span className={styles.switchText}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        {hint && (
          <span id={hintId} className={styles.checkboxHint}>
            {hint}
          </span>
        )}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={hint ? hintId : undefined}
        disabled={disabled}
        className={styles.switch}
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}

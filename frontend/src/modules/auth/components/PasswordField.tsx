"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import styles from "../auth.module.css";

type PasswordFieldProps = {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
};

export function PasswordField({
  id,
  name,
  label,
  value,
  onChange,
  autoComplete = "current-password",
  required = true,
  minLength,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.passwordWrap}>
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
        />
        <button
          type="button"
          className={styles.togglePassword}
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? (
            <EyeOff size={18} aria-hidden />
          ) : (
            <Eye size={18} aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}

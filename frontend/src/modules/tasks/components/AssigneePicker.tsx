"use client";

import { useMemo, useState } from "react";
import { hasPermission, useAuth } from "@/modules/auth";
import { FormField, Select, TextInput } from "@/modules/design-system";
import {
  canAssignToOtherMembers,
  initialsFromName,
} from "../tasks.helpers";
import type { CandidateOption } from "../tasks.types";
import styles from "./assignee-picker.module.css";

/**
 * Searchable assignee select. Shows ACTIVE eligible members with initials,
 * full name, and role. When the actor cannot assign others (member role),
 * only self-assign is offered — even if `tasks:assign` is present.
 */
export function AssigneePicker({
  value,
  onChange,
  options,
  disabled = false,
  id,
  allowUnassigned = true,
  label = "Assignee",
  required = false,
}: {
  value: string;
  onChange: (assigneeId: string) => void;
  options: CandidateOption[];
  disabled?: boolean;
  id?: string;
  allowUnassigned?: boolean;
  label?: string;
  required?: boolean;
}) {
  const { profile, permissions, selectedWorkspace } = useAuth();
  const canAssignOthers =
    hasPermission(permissions, "tasks:assign") &&
    canAssignToOtherMembers(selectedWorkspace?.roleKey);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const base = canAssignOthers
      ? options
      : options.filter((option) => option.id === profile?.id);

    const needle = query.trim().toLowerCase();
    if (!needle) {
      return base;
    }

    return base.filter((option) => {
      const haystack = `${option.name} ${option.role ?? ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [options, canAssignOthers, profile?.id, query]);

  // Keep the current value visible even if filtered out.
  const selectOptions = useMemo(() => {
    if (!value) {
      return filtered;
    }

    const current = options.find((option) => option.id === value);
    if (current && !filtered.some((option) => option.id === value)) {
      return [current, ...filtered];
    }

    return filtered;
  }, [filtered, options, value]);

  const selected = options.find((option) => option.id === value) ?? null;
  const selfOption = profile
    ? options.find((option) => option.id === profile.id) ?? {
        id: profile.id,
        name: profile.fullName,
        role: selectedWorkspace?.roleKey ?? null,
      }
    : null;

  const hint = canAssignOthers
    ? "Search by name or role — private projects only list project members"
    : "You can only assign tasks to yourself";

  const preview = canAssignOthers ? selected : selfOption;

  return (
    <div>
      {canAssignOthers && options.length > 6 && (
        <TextInput
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter people…"
          aria-label="Filter assignees"
          style={{ marginBottom: 8 }}
        />
      )}
      <FormField label={label} hint={hint} required={required} id={id}>
        {(props) => (
          <div className={styles.pickerRow}>
            {preview && (
              <span className={styles.avatar} aria-hidden>
                {initialsFromName(preview.name)}
              </span>
            )}
            <Select
              {...props}
              value={value}
              disabled={disabled}
              onChange={(event) => onChange(event.target.value)}
              className={styles.select}
            >
              {allowUnassigned && <option value="">Unassigned</option>}
              {!canAssignOthers && profile && (
                <option value={profile.id}>
                  {profile.fullName} (you)
                  {selfOption?.role ? ` · ${selfOption.role}` : ""}
                </option>
              )}
              {canAssignOthers &&
                selectOptions.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.id === profile?.id
                      ? `${member.name} (you)${member.role ? ` · ${member.role}` : ""}`
                      : member.role
                        ? `${member.name} · ${member.role}`
                        : member.name}
                  </option>
                ))}
            </Select>
          </div>
        )}
      </FormField>
    </div>
  );
}

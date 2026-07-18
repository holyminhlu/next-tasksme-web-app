/**
 * Defensive coercion helpers for mapping loosely-typed API payloads into
 * strict frontend types. Backend response details may vary slightly between
 * phases, so every mapper tolerates missing/renamed/mistyped fields.
 */

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function asStringArray(value: unknown): string[] {
  return asArray(value).filter(
    (item): item is string => typeof item === "string" && item.trim() !== "",
  );
}

/** Returns the first non-null coerced value among the given keys. */
export function pick<T>(
  record: Record<string, unknown> | null,
  keys: string[],
  coerce: (value: unknown) => T | null,
): T | null {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const coerced = coerce(record[key]);

    if (coerced !== null) {
      return coerced;
    }
  }

  return null;
}

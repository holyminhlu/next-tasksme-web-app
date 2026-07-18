import { ValidationError } from "../../lib/errors.js";
import type { CustomFieldType } from "../../../generated/prisma/client.js";

type FieldOption = { value: string; label: string };

export function parseOptions(optionsJson: unknown): FieldOption[] {
  if (!Array.isArray(optionsJson)) return [];
  return optionsJson
    .filter(
      (item): item is FieldOption =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as FieldOption).value === "string" &&
        typeof (item as FieldOption).label === "string",
    )
    .map((item) => ({ value: item.value, label: item.label }));
}

export function validateCustomFieldValue(
  fieldType: CustomFieldType,
  value: unknown,
  optionsJson: unknown,
  isRequired: boolean,
  fieldName: string,
): unknown {
  const isEmpty =
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0);

  if (isEmpty) {
    if (isRequired) {
      throw new ValidationError(`${fieldName} is required`, {
        field: fieldName,
      });
    }
    return null;
  }

  const options = parseOptions(optionsJson);
  const optionValues = new Set(options.map((option) => option.value));

  switch (fieldType) {
    case "TEXT": {
      if (typeof value !== "string") {
        throw new ValidationError(`${fieldName} must be text`, { field: fieldName });
      }
      const trimmed = value.trim();
      if (trimmed.length > 2000) {
        throw new ValidationError(`${fieldName} is too long`, { field: fieldName });
      }
      return trimmed;
    }
    case "NUMBER": {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new ValidationError(`${fieldName} must be a number`, {
          field: fieldName,
        });
      }
      return value;
    }
    case "BOOLEAN": {
      if (typeof value !== "boolean") {
        throw new ValidationError(`${fieldName} must be a boolean`, {
          field: fieldName,
        });
      }
      return value;
    }
    case "DATE": {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new ValidationError(`${fieldName} must be a YYYY-MM-DD date`, {
          field: fieldName,
        });
      }
      return value;
    }
    case "SELECT": {
      if (typeof value !== "string" || !optionValues.has(value)) {
        throw new ValidationError(`${fieldName} must be one of the configured options`, {
          field: fieldName,
        });
      }
      return value;
    }
    case "MULTI_SELECT": {
      if (
        !Array.isArray(value) ||
        value.some((item) => typeof item !== "string" || !optionValues.has(item))
      ) {
        throw new ValidationError(
          `${fieldName} must be an array of configured options`,
          { field: fieldName },
        );
      }
      return [...new Set(value as string[])];
    }
    case "USER": {
      if (typeof value !== "string") {
        throw new ValidationError(`${fieldName} must be a user id`, {
          field: fieldName,
        });
      }
      return value;
    }
    default:
      throw new ValidationError(`Unsupported field type`, { field: fieldName });
  }
}

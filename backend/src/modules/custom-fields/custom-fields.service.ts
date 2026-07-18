import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { recordActivity, ACTIVITY_ACTIONS } from "../../services/activity.service.js";
import {
  assertCanMutateTask,
  getVisibleTask,
  type TaskActor,
} from "../tasks/task-access.js";
import {
  parseOptions,
  validateCustomFieldValue,
} from "./custom-field-values.js";
import type {
  CreateCustomFieldInput,
  ListCustomFieldsQuery,
  SetTaskCustomFieldValuesInput,
  UpdateCustomFieldInput,
} from "./custom-fields.schemas.js";

function mapDefinition(field: {
  id: string;
  workspaceId: string;
  projectId: string | null;
  name: string;
  fieldType: string;
  isRequired: boolean;
  optionsJson: Prisma.JsonValue;
  defaultValueJson: Prisma.JsonValue | null;
  position: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: field.id,
    workspaceId: field.workspaceId,
    projectId: field.projectId,
    name: field.name,
    fieldType: field.fieldType,
    isRequired: field.isRequired,
    options: parseOptions(field.optionsJson),
    defaultValue: field.defaultValueJson,
    position: field.position,
    isActive: field.isActive,
    createdAt: field.createdAt.toISOString(),
    updatedAt: field.updatedAt.toISOString(),
  };
}

export const customFieldsService = {
  async list(workspaceId: string, query: ListCustomFieldsQuery = {}) {
    const fields = await prisma.customFieldDefinition.findMany({
      where: {
        workspaceId,
        ...(query.includeInactive ? {} : { isActive: true }),
        ...(query.projectId
          ? {
              OR: [{ projectId: null }, { projectId: query.projectId }],
            }
          : {}),
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    return fields.map(mapDefinition);
  },

  async create(
    workspaceId: string,
    actor: TaskActor,
    input: CreateCustomFieldInput,
  ) {
    if (input.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: input.projectId, workspaceId, deletedAt: null },
      });
      if (!project) {
        throw new ValidationError("projectId must belong to this workspace", {
          field: "projectId",
        });
      }
    }

    if (input.defaultValue !== undefined && input.defaultValue !== null) {
      validateCustomFieldValue(
        input.fieldType,
        input.defaultValue,
        input.options,
        false,
        input.name,
      );
    }

    const last = await prisma.customFieldDefinition.findFirst({
      where: { workspaceId, projectId: input.projectId ?? null },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const field = await prisma.customFieldDefinition.create({
      data: {
        workspaceId,
        projectId: input.projectId ?? null,
        name: input.name,
        fieldType: input.fieldType,
        isRequired: input.isRequired ?? false,
        optionsJson: input.options ?? [],
        defaultValueJson:
          input.defaultValue === undefined
            ? undefined
            : (input.defaultValue as Prisma.InputJsonValue),
        position: input.position ?? (last?.position ?? 0) + 1000,
      },
    });

    await recordActivity({
      workspaceId,
      actorId: actor.userId,
      action: ACTIVITY_ACTIONS.CUSTOM_FIELD_CONFIGURED,
      resourceType: "custom_field",
      resourceId: field.id,
      projectId: field.projectId,
      summary: `Configured custom field "${field.name}"`,
    });

    return mapDefinition(field);
  },

  async update(
    workspaceId: string,
    fieldId: string,
    actor: TaskActor,
    input: UpdateCustomFieldInput,
  ) {
    const existing = await prisma.customFieldDefinition.findFirst({
      where: { id: fieldId, workspaceId },
    });
    if (!existing) throw new NotFoundError("Custom field not found");

    const options = input.options ?? parseOptions(existing.optionsJson);
    if (input.defaultValue !== undefined && input.defaultValue !== null) {
      validateCustomFieldValue(
        existing.fieldType,
        input.defaultValue,
        options,
        false,
        existing.name,
      );
    }

    const field = await prisma.customFieldDefinition.update({
      where: { id: fieldId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.isRequired !== undefined ? { isRequired: input.isRequired } : {}),
        ...(input.options !== undefined ? { optionsJson: input.options } : {}),
        ...(input.defaultValue !== undefined
          ? {
              defaultValueJson:
                input.defaultValue === null
                  ? Prisma.JsonNull
                  : (input.defaultValue as Prisma.InputJsonValue),
            }
          : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    await recordActivity({
      workspaceId,
      actorId: actor.userId,
      action: ACTIVITY_ACTIONS.CUSTOM_FIELD_CONFIGURED,
      resourceType: "custom_field",
      resourceId: field.id,
      projectId: field.projectId,
      summary: `Updated custom field "${field.name}"`,
    });

    return mapDefinition(field);
  },

  async remove(workspaceId: string, fieldId: string, actor: TaskActor) {
    const existing = await prisma.customFieldDefinition.findFirst({
      where: { id: fieldId, workspaceId },
    });
    if (!existing) throw new NotFoundError("Custom field not found");

    // Soft-deactivate to preserve historical values.
    const field = await prisma.customFieldDefinition.update({
      where: { id: fieldId },
      data: { isActive: false },
    });

    await recordActivity({
      workspaceId,
      actorId: actor.userId,
      action: ACTIVITY_ACTIONS.CUSTOM_FIELD_CONFIGURED,
      resourceType: "custom_field",
      resourceId: field.id,
      projectId: field.projectId,
      summary: `Deactivated custom field "${field.name}"`,
    });

    return mapDefinition(field);
  },

  async listValues(workspaceId: string, taskId: string, actor: TaskActor) {
    const task = await getVisibleTask(workspaceId, taskId, actor);
    const definitions = await prisma.customFieldDefinition.findMany({
      where: {
        workspaceId,
        isActive: true,
        OR: [{ projectId: null }, { projectId: task.projectId ?? undefined }],
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    const values = await prisma.taskCustomFieldValue.findMany({
      where: {
        taskId,
        customFieldId: { in: definitions.map((field) => field.id) },
      },
    });
    const valueByField = new Map(
      values.map((row) => [row.customFieldId, row.valueJson]),
    );

    return definitions.map((field) => ({
      field: mapDefinition(field),
      value: valueByField.has(field.id) ? valueByField.get(field.id)! : null,
    }));
  },

  async setValues(
    workspaceId: string,
    taskId: string,
    actor: TaskActor,
    input: SetTaskCustomFieldValuesInput,
  ) {
    const task = await getVisibleTask(workspaceId, taskId, actor);
    assertCanMutateTask(actor, task, "update custom fields");

    const fieldIds = input.values.map((row) => row.customFieldId);
    const definitions = await prisma.customFieldDefinition.findMany({
      where: {
        workspaceId,
        id: { in: fieldIds },
        isActive: true,
        OR: [{ projectId: null }, { projectId: task.projectId ?? undefined }],
      },
    });
    if (definitions.length !== fieldIds.length) {
      throw new ValidationError("One or more custom fields are invalid", {
        field: "values",
      });
    }

    const definitionById = new Map(definitions.map((field) => [field.id, field]));

    for (const row of input.values) {
      const field = definitionById.get(row.customFieldId)!;
      if (field.fieldType === "USER" && row.value) {
        const member = await prisma.workspaceMember.findFirst({
          where: {
            workspaceId,
            userId: String(row.value),
            deletedAt: null,
            status: "ACTIVE",
          },
        });
        if (!member) {
          throw new ValidationError(`${field.name} must reference an active member`, {
            field: field.name,
          });
        }
      }
      const validated = validateCustomFieldValue(
        field.fieldType,
        row.value,
        field.optionsJson,
        field.isRequired,
        field.name,
      );

      if (validated === null) {
        await prisma.taskCustomFieldValue.deleteMany({
          where: { taskId, customFieldId: field.id },
        });
      } else {
        await prisma.taskCustomFieldValue.upsert({
          where: {
            taskId_customFieldId: {
              taskId,
              customFieldId: field.id,
            },
          },
          create: {
            taskId,
            customFieldId: field.id,
            valueJson: validated as Prisma.InputJsonValue,
            updatedById: actor.userId,
          },
          update: {
            valueJson: validated as Prisma.InputJsonValue,
            updatedById: actor.userId,
          },
        });
      }
    }

    // Enforce required fields still satisfied after update.
    const activeRequired = await prisma.customFieldDefinition.findMany({
      where: {
        workspaceId,
        isActive: true,
        isRequired: true,
        OR: [{ projectId: null }, { projectId: task.projectId ?? undefined }],
      },
    });
    const currentValues = await prisma.taskCustomFieldValue.findMany({
      where: {
        taskId,
        customFieldId: { in: activeRequired.map((field) => field.id) },
      },
    });
    const present = new Set(currentValues.map((row) => row.customFieldId));
    for (const field of activeRequired) {
      if (!present.has(field.id)) {
        throw new ValidationError(`${field.name} is required`, {
          field: field.name,
        });
      }
    }

    await recordActivity({
      workspaceId,
      actorId: actor.userId,
      action: ACTIVITY_ACTIONS.CUSTOM_FIELD_VALUE_UPDATED,
      resourceType: "task",
      resourceId: taskId,
      projectId: task.projectId,
      summary: `Updated custom fields on "${task.title}"`,
    });

    return this.listValues(workspaceId, taskId, actor);
  },
};

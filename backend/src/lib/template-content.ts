import { createHash } from "node:crypto";
import { z } from "zod";
import { workflowConditionsSchema } from "./workflow-conditions.js";

const KEY = /^[a-z][a-z0-9_-]{0,63}$/;
const keySchema = z.string().trim().regex(KEY);
const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string().max(10_000),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema).max(100),
    z.record(z.string().max(128), jsonValueSchema),
  ]),
);

const offsetSchema = z.number().int().min(-3650).max(3650);
const projectRoleSchema = z.enum([
  "PROJECT_OWNER",
  "PROJECT_MANAGER",
  "PROJECT_MEMBER",
  "PROJECT_VIEWER",
]);

const memberPlaceholderSchema = z
  .object({
    key: keySchema,
    name: z.string().trim().min(1).max(120),
    projectRole: projectRoleSchema.default("PROJECT_MEMBER"),
    required: z.boolean().default(false),
  })
  .strict();

const workflowStageSchema = z
  .object({
    key: keySchema,
    name: z.string().trim().min(1).max(120),
    category: z.enum([
      "BACKLOG",
      "NOT_STARTED",
      "IN_PROGRESS",
      "BLOCKED",
      "COMPLETED",
      "CANCELLED",
    ]),
    color: z.string().trim().max(32).nullable().optional(),
    position: z.number().int().min(0).max(99),
    isInitial: z.boolean().default(false),
    isTerminal: z.boolean().default(false),
    isActive: z.boolean().default(true),
  })
  .strict();

const workflowTransitionSchema = z
  .object({
    fromKey: keySchema,
    toKey: keySchema,
    requiredPermission: z.string().trim().min(1).max(128).nullable().optional(),
    conditionsJson: workflowConditionsSchema.optional().default({}),
  })
  .strict();

const tagSchema = z
  .object({
    key: keySchema,
    name: z.string().trim().min(1).max(80),
    color: z.string().trim().min(1).max(32),
  })
  .strict();

const customFieldSchema = z
  .object({
    key: keySchema,
    name: z.string().trim().min(1).max(120),
    fieldType: z.enum(["TEXT", "NUMBER", "BOOLEAN", "DATE", "SELECT", "MULTI_SELECT", "USER"]),
    isRequired: z.boolean().default(false),
    options: z.array(jsonValueSchema).max(100).default([]),
    defaultValue: jsonValueSchema.optional(),
    position: z.number().int().min(0).max(199),
    isActive: z.boolean().default(true),
  })
  .strict();

const milestoneSchema = z
  .object({
    key: keySchema,
    name: z.string().trim().min(1).max(120),
    description: z.string().max(5000).nullable().optional(),
    status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).default("PLANNED"),
    position: z.number().int().min(0).max(499),
    startOffsetDays: offsetSchema.nullable().optional(),
    dueOffsetDays: offsetSchema.nullable().optional(),
  })
  .strict();

const checklistSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    position: z.number().int().min(0).max(499),
    isCompleted: z.boolean().default(false),
  })
  .strict();

const taskSchema = z
  .object({
    key: keySchema,
    title: z.string().trim().min(1).max(500),
    description: z.string().max(20_000).nullable().optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
    stageKey: keySchema,
    parentKey: keySchema.nullable().optional(),
    subtaskPosition: z.number().int().min(0).max(9999).nullable().optional(),
    milestoneKey: keySchema.nullable().optional(),
    assigneePlaceholderKey: keySchema.nullable().optional(),
    startOffsetDays: offsetSchema.nullable().optional(),
    dueOffsetDays: offsetSchema.nullable().optional(),
    durationDays: z.number().int().min(0).max(3650).nullable().optional(),
    position: z.number().int().min(0).max(9999),
    checklist: z.array(checklistSchema).max(500).default([]),
    tagKeys: z.array(keySchema).max(100).default([]),
    customValues: z.record(keySchema, jsonValueSchema).default({}),
  })
  .strict();

const dependencySchema = z
  .object({
    predecessorKey: keySchema,
    successorKey: keySchema,
    dependencyType: z.literal("FINISH_TO_START").default("FINISH_TO_START"),
  })
  .strict();

export const templateContentV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    project: z
      .object({
        description: z.string().max(5000).nullable().optional(),
        status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD"]).default("ACTIVE"),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
        visibility: z.enum(["WORKSPACE", "PRIVATE"]).default("WORKSPACE"),
        completionPolicy: z.enum(["WARN_ONLY", "BLOCK", "BLOCK_WITH_OVERRIDE"]).default("WARN_ONLY"),
        managerPlaceholderKey: keySchema.nullable().optional(),
      })
      .strict(),
    memberPlaceholders: z.array(memberPlaceholderSchema).max(100).default([]),
    workflow: z
      .object({
        name: z.string().trim().min(1).max(120),
        stages: z.array(workflowStageSchema).min(1).max(100),
        transitions: z.array(workflowTransitionSchema).max(500),
      })
      .strict(),
    tags: z.array(tagSchema).max(200).default([]),
    customFields: z.array(customFieldSchema).max(200).default([]),
    milestones: z.array(milestoneSchema).max(500).default([]),
    tasks: z.array(taskSchema).max(5000).default([]),
    dependencies: z.array(dependencySchema).max(20_000).default([]),
  })
  .strict()
  .superRefine((content, ctx) => {
    const issue = (message: string, path: (string | number)[]) =>
      ctx.addIssue({ code: "custom", message, path });
    const unique = <T>(
      values: T[],
      value: (item: T) => string | number,
      label: string,
      path: string,
    ) => {
      const seen = new Set<string | number>();
      values.forEach((item, index) => {
        const current = value(item);
        if (seen.has(current)) issue(`${label} must be unique`, [path, index]);
        seen.add(current);
      });
    };

    unique(content.memberPlaceholders, (v) => v.key, "Placeholder keys", "memberPlaceholders");
    unique(content.workflow.stages, (v) => v.key, "Stage keys", "workflow");
    unique(content.workflow.stages, (v) => v.name.toLocaleLowerCase(), "Stage names", "workflow");
    unique(content.workflow.stages, (v) => v.position, "Stage positions", "workflow");
    unique(content.tags, (v) => v.key, "Tag keys", "tags");
    unique(content.tags, (v) => v.name.toLocaleLowerCase(), "Tag names", "tags");
    unique(content.customFields, (v) => v.key, "Custom field keys", "customFields");
    unique(content.customFields, (v) => v.name.toLocaleLowerCase(), "Custom field names", "customFields");
    unique(content.customFields, (v) => v.position, "Custom field positions", "customFields");
    unique(content.milestones, (v) => v.key, "Milestone keys", "milestones");
    unique(content.milestones, (v) => v.name.toLocaleLowerCase(), "Milestone names", "milestones");
    unique(content.milestones, (v) => v.position, "Milestone positions", "milestones");
    unique(content.tasks, (v) => v.key, "Task keys", "tasks");
    unique(content.tasks.filter((v) => !v.parentKey), (v) => v.position, "Root task positions", "tasks");

    if (content.workflow.stages.filter((stage) => stage.isInitial).length !== 1)
      issue("Workflow must have exactly one initial stage", ["workflow", "stages"]);
    if (content.workflow.stages.filter((stage) => stage.isTerminal).length !== 1)
      issue("Workflow must have exactly one terminal stage", ["workflow", "stages"]);

    const stageKeys = new Set(content.workflow.stages.map((v) => v.key));
    const placeholderKeys = new Set(content.memberPlaceholders.map((v) => v.key));
    const tagKeys = new Set(content.tags.map((v) => v.key));
    const fieldKeys = new Set(content.customFields.map((v) => v.key));
    const milestoneKeys = new Set(content.milestones.map((v) => v.key));
    const taskKeys = new Set(content.tasks.map((v) => v.key));
    if (content.project.managerPlaceholderKey && !placeholderKeys.has(content.project.managerPlaceholderKey))
      issue("Unknown manager placeholder", ["project", "managerPlaceholderKey"]);

    const transitions = new Set<string>();
    content.workflow.transitions.forEach((transition, index) => {
      if (!stageKeys.has(transition.fromKey) || !stageKeys.has(transition.toKey))
        issue("Transition references an unknown stage", ["workflow", "transitions", index]);
      if (transition.fromKey === transition.toKey)
        issue("Transition cannot point to the same stage", ["workflow", "transitions", index]);
      const pair = `${transition.fromKey}:${transition.toKey}`;
      if (transitions.has(pair)) issue("Duplicate transition", ["workflow", "transitions", index]);
      transitions.add(pair);
    });

    const parents = new Map<string, string>();
    content.tasks.forEach((task, index) => {
      if (!stageKeys.has(task.stageKey)) issue("Unknown stageKey", ["tasks", index, "stageKey"]);
      if (task.parentKey) {
        if (!taskKeys.has(task.parentKey)) issue("Unknown parentKey", ["tasks", index, "parentKey"]);
        if (task.parentKey === task.key) issue("Task cannot parent itself", ["tasks", index, "parentKey"]);
        parents.set(task.key, task.parentKey);
      }
      if (task.milestoneKey && !milestoneKeys.has(task.milestoneKey))
        issue("Unknown milestoneKey", ["tasks", index, "milestoneKey"]);
      if (task.assigneePlaceholderKey && !placeholderKeys.has(task.assigneePlaceholderKey))
        issue("Unknown assignee placeholder", ["tasks", index, "assigneePlaceholderKey"]);
      unique(task.checklist, (v) => v.position, "Checklist positions", "tasks");
      for (const tag of task.tagKeys)
        if (!tagKeys.has(tag)) issue("Unknown tag key", ["tasks", index, "tagKeys"]);
      for (const field of Object.keys(task.customValues))
        if (!fieldKeys.has(field)) issue("Unknown custom field key", ["tasks", index, "customValues"]);
    });

    for (const key of taskKeys) {
      const visited = new Set<string>();
      let cursor: string | undefined = key;
      while (cursor && parents.has(cursor)) {
        if (visited.has(cursor)) {
          issue("Task parent cycle detected", ["tasks"]);
          break;
        }
        visited.add(cursor);
        cursor = parents.get(cursor);
      }
    }

    const graph = new Map<string, string[]>();
    content.dependencies.forEach((dependency, index) => {
      if (!taskKeys.has(dependency.predecessorKey) || !taskKeys.has(dependency.successorKey))
        issue("Dependency references an unknown task", ["dependencies", index]);
      if (dependency.predecessorKey === dependency.successorKey)
        issue("Task cannot depend on itself", ["dependencies", index]);
      graph.set(dependency.predecessorKey, [
        ...(graph.get(dependency.predecessorKey) ?? []),
        dependency.successorKey,
      ]);
    });
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (key: string): boolean => {
      if (visiting.has(key)) return true;
      if (visited.has(key)) return false;
      visiting.add(key);
      if ((graph.get(key) ?? []).some(visit)) return true;
      visiting.delete(key);
      visited.add(key);
      return false;
    };
    if ([...taskKeys].some(visit)) issue("Task dependency cycle detected", ["dependencies"]);
  });

export type TemplateContentV2 = z.infer<typeof templateContentV2Schema>;

export function canonicalJson(value: unknown): string {
  const normalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === "object")
      return Object.fromEntries(
        Object.entries(item as Record<string, unknown>)
          .filter(([, child]) => child !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, child]) => [key, normalize(child)]),
      );
    return item;
  };
  return JSON.stringify(normalize(value));
}

export function validateTemplateContent(value: unknown): TemplateContentV2 {
  return templateContentV2Schema.parse(value);
}

export function canonicalizeTemplateContent(value: unknown): {
  content: TemplateContentV2;
  json: string;
  hash: string;
} {
  const content = validateTemplateContent(value);
  const json = canonicalJson(content);
  return { content, json, hash: createHash("sha256").update(json).digest("hex") };
}

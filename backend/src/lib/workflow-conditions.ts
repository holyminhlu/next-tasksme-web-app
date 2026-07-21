import { z } from "zod";

const taskPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

const assigneeClauseSchema = z
  .object({
    field: z.literal("task.assigneeId"),
    operator: z.enum(["isSet", "isNotSet"]),
  })
  .strict();

const priorityClauseSchema = z.discriminatedUnion("operator", [
  z
    .object({
      field: z.literal("task.priority"),
      operator: z.literal("eq"),
      value: taskPrioritySchema,
    })
    .strict(),
  z
    .object({
      field: z.literal("task.priority"),
      operator: z.literal("in"),
      value: z.array(taskPrioritySchema).min(1).max(4),
    })
    .strict(),
]);

function booleanClause(field: string) {
  return z
    .object({
      field: z.literal(field),
      operator: z.literal("eq"),
      value: z.boolean(),
    })
    .strict();
}

export const workflowConditionClauseSchema = z.union([
  assigneeClauseSchema,
  priorityClauseSchema,
  booleanClause("task.isBlocked"),
  booleanClause("task.checklistComplete"),
  booleanClause("task.dependenciesComplete"),
]);

const unconditionalWorkflowConditionsSchema = z.object({}).strict();
const versionOneWorkflowConditionsSchema = z
  .object({
    version: z.literal(1),
    all: z.array(workflowConditionClauseSchema).min(1).max(20),
  })
  .strict();

export const workflowConditionsSchema = z.union([
  unconditionalWorkflowConditionsSchema,
  versionOneWorkflowConditionsSchema,
]);

export type WorkflowConditions = z.infer<typeof workflowConditionsSchema>;
export type WorkflowConditionContext = {
  task: {
    assigneeId: string | null;
    priority: z.infer<typeof taskPrioritySchema>;
    isBlocked: boolean;
    checklistComplete: boolean;
    dependenciesComplete: boolean;
  };
};

export function parseWorkflowConditions(input: unknown): WorkflowConditions {
  return workflowConditionsSchema.parse(input);
}

export function validateWorkflowConditions(input: unknown) {
  return workflowConditionsSchema.safeParse(input);
}

export function evaluateWorkflowConditions(
  input: unknown,
  context: WorkflowConditionContext,
): boolean {
  const parsed = validateWorkflowConditions(input);
  if (!parsed.success) return false;
  if (!("version" in parsed.data)) return true;

  return parsed.data.all.every((clause) => {
    switch (clause.field) {
      case "task.assigneeId":
        return clause.operator === "isSet"
          ? context.task.assigneeId !== null
          : context.task.assigneeId === null;
      case "task.priority":
        return clause.operator === "eq"
          ? context.task.priority === clause.value
          : clause.value.includes(context.task.priority);
      case "task.isBlocked":
        return context.task.isBlocked === clause.value;
      case "task.checklistComplete":
        return context.task.checklistComplete === clause.value;
      case "task.dependenciesComplete":
        return context.task.dependenciesComplete === clause.value;
    }
  });
}

import { createHash } from "node:crypto";
import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { initialRank } from "../../lib/rank.js";
import {
  canonicalJson,
  canonicalizeTemplateContent,
  type TemplateContentV2,
} from "../../lib/template-content.js";
import { taskTemplateDates, templateOffsetDate } from "../../lib/template-dates.js";
import type { CloneTemplateInput } from "./templates.schemas.js";

const SYNC_TASK_THRESHOLD = 100;
type Actor = { userId: string; roleKey: string };
export type ClonePayload = CloneTemplateInput & { actorId: string };

function legacyStatus(category: TemplateContentV2["workflow"]["stages"][number]["category"]) {
  if (category === "IN_PROGRESS") return "IN_PROGRESS" as const;
  if (category === "BLOCKED") return "BLOCKED" as const;
  if (category === "COMPLETED") return "DONE" as const;
  if (category === "CANCELLED") return "CANCELLED" as const;
  return "TODO" as const;
}

function requestHash(templateId: string, contentHash: string, payload: ClonePayload): string {
  return createHash("sha256")
    .update(canonicalJson({ templateId, contentHash, payload }))
    .digest("hex");
}

function orderedTasks(content: TemplateContentV2) {
  const byKey = new Map(content.tasks.map((task) => [task.key, task]));
  const depth = (key: string): number => {
    let current = byKey.get(key);
    let result = 0;
    while (current?.parentKey) {
      result += 1;
      current = byKey.get(current.parentKey);
    }
    return result;
  };
  return [...content.tasks].sort(
    (a, b) => depth(a.key) - depth(b.key) || a.position - b.position || a.key.localeCompare(b.key),
  );
}

export async function materializeCloneJob(params: {
  cloneJobId: string;
  leaseToken?: string;
  onProgress?: (progress: number) => Promise<void>;
}) {
  const job = await prisma.cloneJob.findUnique({ where: { id: params.cloneJobId } });
  if (!job) throw new NotFoundError("Clone job not found");
  if (params.leaseToken && job.leaseToken !== params.leaseToken)
    throw new ConflictError("Clone job lease is no longer owned");

  const existingProject = await prisma.project.findUnique({
    where: { sourceCloneJobId: job.id },
  });
  if (existingProject) return { projectId: existingProject.id, taskCount: 0 };

  const template = await prisma.projectTemplate.findUnique({ where: { id: job.templateId } });
  if (!template || template.status !== "PUBLISHED")
    throw new NotFoundError("Published template not found");
  const parsed = canonicalizeTemplateContent(template.contentJson);
  if (!job.templateContentHash || parsed.hash !== job.templateContentHash)
    throw new ConflictError("Template content no longer matches the clone snapshot");
  const payload = job.payloadJson as unknown as ClonePayload;
  if (!payload?.actorId || !payload.projectName) throw new ValidationError("Invalid clone payload");

  const workspace = await prisma.workspace.findUnique({
    where: { id: job.workspaceId },
    select: { timezone: true },
  });
  if (!workspace) throw new NotFoundError("Workspace not found");

  const bindings = payload.memberBindings ?? {};
  const requestedUserIds = [...new Set([payload.actorId, ...Object.values(bindings)])];
  const activeMembers = await prisma.workspaceMember.findMany({
    where: { workspaceId: job.workspaceId, userId: { in: requestedUserIds }, status: "ACTIVE" },
    select: { userId: true },
  });
  const activeIds = new Set(activeMembers.map((member) => member.userId));
  if (requestedUserIds.some((id) => !activeIds.has(id)))
    throw new ValidationError("All template member bindings must be active workspace members");
  for (const placeholder of parsed.content.memberPlaceholders)
    if (placeholder.required && !bindings[placeholder.key])
      throw new ValidationError(`Missing required member binding: ${placeholder.key}`);

  const projectStart = payload.startAt ? new Date(payload.startAt) : new Date();
  if (Number.isNaN(projectStart.getTime())) throw new ValidationError("Invalid project start date");

  const result = await prisma.$transaction(async (tx) => {
    const replay = await tx.project.findUnique({ where: { sourceCloneJobId: job.id } });
    if (replay) return { projectId: replay.id, taskCount: parsed.content.tasks.length };

    const managerKey = parsed.content.project.managerPlaceholderKey;
    const project = await tx.project.create({
      data: {
        workspaceId: job.workspaceId,
        name: payload.projectName,
        code: payload.projectCode,
        description: parsed.content.project.description ?? template.description,
        status: parsed.content.project.status,
        priority: parsed.content.project.priority,
        visibility: parsed.content.project.visibility,
        completionPolicy: parsed.content.project.completionPolicy,
        managerId: managerKey ? bindings[managerKey] : null,
        startAt: projectStart,
        sourceCloneJobId: job.id,
        createdById: payload.actorId,
      },
    });

    const projectMembers = new Map<string, TemplateContentV2["memberPlaceholders"][number]["projectRole"]>();
    projectMembers.set(payload.actorId, "PROJECT_OWNER");
    for (const placeholder of parsed.content.memberPlaceholders) {
      const userId = bindings[placeholder.key];
      if (userId && !projectMembers.has(userId)) projectMembers.set(userId, placeholder.projectRole);
    }
    for (const [userId, projectRole] of projectMembers) {
      await tx.projectMember.create({
        data: {
          workspaceId: job.workspaceId,
          projectId: project.id,
          userId,
          projectRole,
          addedById: payload.actorId,
        },
      });
    }

    const workflow = await tx.workflow.create({
      data: {
        workspaceId: job.workspaceId,
        sourceProjectId: project.id,
        name: parsed.content.workflow.name,
        version: 1,
        status: "PUBLISHED",
        createdById: payload.actorId,
      },
    });
    const stageIds = new Map<string, string>();
    const stageCategories = new Map<string, TemplateContentV2["workflow"]["stages"][number]["category"]>();
    for (const stage of [...parsed.content.workflow.stages].sort((a, b) => a.position - b.position)) {
      const created = await tx.workflowStage.create({
        data: {
          workflowId: workflow.id,
          name: stage.name,
          category: stage.category,
          color: stage.color,
          position: stage.position,
          isInitial: stage.isInitial,
          isTerminal: stage.isTerminal,
          isActive: stage.isActive,
        },
      });
      stageIds.set(stage.key, created.id);
      stageCategories.set(stage.key, stage.category);
    }
    for (const transition of parsed.content.workflow.transitions) {
      await tx.workflowTransition.create({
        data: {
          workflowId: workflow.id,
          fromStageId: stageIds.get(transition.fromKey)!,
          toStageId: stageIds.get(transition.toKey)!,
          requiredPermission: transition.requiredPermission,
          conditionsJson: transition.conditionsJson as Prisma.InputJsonValue,
        },
      });
    }
    await tx.projectWorkflow.create({
      data: { projectId: project.id, workflowId: workflow.id, workflowVersion: 1 },
    });

    const tagIds = new Map<string, string>();
    for (const tag of parsed.content.tags) {
      const created = await tx.tag.upsert({
        where: { workspaceId_name: { workspaceId: job.workspaceId, name: tag.name } },
        create: {
          workspaceId: job.workspaceId,
          name: tag.name,
          color: tag.color,
          createdById: payload.actorId,
        },
        update: {},
      });
      tagIds.set(tag.key, created.id);
    }

    const fieldIds = new Map<string, string>();
    for (const field of [...parsed.content.customFields].sort((a, b) => a.position - b.position)) {
      const created = await tx.customFieldDefinition.create({
        data: {
          workspaceId: job.workspaceId,
          projectId: project.id,
          name: field.name,
          fieldType: field.fieldType,
          isRequired: field.isRequired,
          optionsJson: field.options as Prisma.InputJsonValue,
          ...(field.defaultValue !== undefined
            ? { defaultValueJson: field.defaultValue as Prisma.InputJsonValue }
            : {}),
          position: field.position,
          isActive: field.isActive,
        },
      });
      fieldIds.set(field.key, created.id);
    }

    const milestoneIds = new Map<string, string>();
    for (const milestone of [...parsed.content.milestones].sort((a, b) => a.position - b.position)) {
      const created = await tx.milestone.create({
        data: {
          workspaceId: job.workspaceId,
          projectId: project.id,
          name: milestone.name,
          description: milestone.description,
          status: milestone.status,
          position: milestone.position,
          startAt: templateOffsetDate(projectStart, milestone.startOffsetDays, workspace.timezone),
          dueAt: templateOffsetDate(projectStart, milestone.dueOffsetDays, workspace.timezone),
          createdById: payload.actorId,
        },
      });
      milestoneIds.set(milestone.key, created.id);
    }

    const tasks = orderedTasks(parsed.content);
    const counter = await tx.workspaceTaskCounter.upsert({
      where: { workspaceId: job.workspaceId },
      create: { workspaceId: job.workspaceId, nextNumber: tasks.length + 1 },
      update: { nextNumber: { increment: tasks.length } },
    });
    let taskNumber = counter.nextNumber - tasks.length;
    const taskIds = new Map<string, string>();
    for (const [index, task] of tasks.entries()) {
      const dates = taskTemplateDates({
        projectStart,
        timezone: workspace.timezone,
        startOffsetDays: task.startOffsetDays,
        dueOffsetDays: task.dueOffsetDays,
        durationDays: task.durationDays,
      });
      const created = await tx.task.create({
        data: {
          workspaceId: job.workspaceId,
          taskNumber: taskNumber++,
          projectId: project.id,
          parentTaskId: task.parentKey ? taskIds.get(task.parentKey) : null,
          subtaskPosition: task.parentKey ? (task.subtaskPosition ?? task.position) : undefined,
          milestoneId: task.milestoneKey ? milestoneIds.get(task.milestoneKey) : null,
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: legacyStatus(stageCategories.get(task.stageKey)!),
          workflowStageId: stageIds.get(task.stageKey),
          startAt: dates.startAt,
          dueDate: dates.dueDate,
          rank: initialRank(index),
          createdById: payload.actorId,
          assigneeId: task.assigneePlaceholderKey
            ? (bindings[task.assigneePlaceholderKey] ?? null)
            : null,
          riskRecalculateAt: new Date(),
        },
      });
      taskIds.set(task.key, created.id);
      for (const item of [...task.checklist].sort((a, b) => a.position - b.position))
        await tx.checklistItem.create({
          data: {
            taskId: created.id,
            title: item.title,
            position: item.position,
            isCompleted: item.isCompleted,
            createdById: payload.actorId,
            ...(item.isCompleted ? { completedById: payload.actorId, completedAt: new Date() } : {}),
          },
        });
      for (const tagKey of task.tagKeys)
        await tx.taskTag.create({ data: { taskId: created.id, tagId: tagIds.get(tagKey)! } });
      for (const [fieldKey, value] of Object.entries(task.customValues))
        await tx.taskCustomFieldValue.create({
          data: {
            taskId: created.id,
            customFieldId: fieldIds.get(fieldKey)!,
            valueJson: value as Prisma.InputJsonValue,
            updatedById: payload.actorId,
          },
        });
      if (params.onProgress)
        await params.onProgress(Math.max(1, Math.round(((index + 1) / Math.max(1, tasks.length)) * 90)));
    }

    for (const dependency of parsed.content.dependencies)
      await tx.taskDependency.create({
        data: {
          workspaceId: job.workspaceId,
          predecessorTaskId: taskIds.get(dependency.predecessorKey)!,
          successorTaskId: taskIds.get(dependency.successorKey)!,
          dependencyType: dependency.dependencyType,
          createdById: payload.actorId,
        },
      });

    return { projectId: project.id, taskCount: tasks.length };
  });
  return result;
}

async function existingClone(workspaceId: string, key: string, hash: string) {
  const existing = await prisma.cloneJob.findUnique({
    where: { workspaceId_idempotencyKey: { workspaceId, idempotencyKey: key } },
  });
  if (!existing) return null;
  if (existing.requestHash !== hash)
    throw new ConflictError("Idempotency key was already used with a different request");
  return existing;
}

export async function clonePublishedTemplate(
  workspaceId: string,
  templateId: string,
  actor: Actor,
  input: CloneTemplateInput,
) {
  const template = await prisma.projectTemplate.findFirst({
    where: {
      id: templateId,
      status: "PUBLISHED",
      OR: [{ workspaceId }, { visibility: "SYSTEM" }],
    },
  });
  if (!template) throw new NotFoundError("Published template not found");
  const canonical = canonicalizeTemplateContent(template.contentJson);
  if (template.contentHash && template.contentHash !== canonical.hash)
    throw new ConflictError("Published template content hash is invalid");
  const payload: ClonePayload = { ...input, actorId: actor.userId };
  const hash = requestHash(template.id, canonical.hash, payload);
  const replay = await existingClone(workspaceId, input.idempotencyKey, hash);
  if (replay)
    return {
      mode: "existing" as const,
      cloneJobId: replay.id,
      projectId: replay.projectId,
    };

  let job;
  try {
    job = await prisma.cloneJob.create({
      data: {
        workspaceId,
        templateId: template.id,
        status: canonical.content.tasks.length > SYNC_TASK_THRESHOLD ? "PENDING" : "PROCESSING",
        idempotencyKey: input.idempotencyKey,
        payloadJson: payload as unknown as Prisma.InputJsonValue,
        requestHash: hash,
        templateContentHash: canonical.hash,
        createdById: actor.userId,
      },
    });
  } catch (error) {
    const raced = await existingClone(workspaceId, input.idempotencyKey, hash);
    if (raced)
      return { mode: "existing" as const, cloneJobId: raced.id, projectId: raced.projectId };
    throw error;
  }

  if (canonical.content.tasks.length > SYNC_TASK_THRESHOLD)
    return { mode: "async" as const, cloneJobId: job.id, projectId: null };

  try {
    const result = await materializeCloneJob({ cloneJobId: job.id });
    await prisma.cloneJob.update({
      where: { id: job.id },
      data: {
        projectId: result.projectId,
        status: "COMPLETED",
        progress: 100,
        completedAt: new Date(),
        resultJson: result,
      },
    });
    return { mode: "sync" as const, cloneJobId: job.id, projectId: result.projectId };
  } catch (error) {
    await prisma.cloneJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Clone failed",
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

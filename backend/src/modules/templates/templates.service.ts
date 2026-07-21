export {
  ensureSystemTemplates,
  templatesService,
} from "./template-lifecycle.service.js";
export {
  claimPendingCloneJobs,
  processCloneJob,
} from "./clone-jobs.service.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { buildPaginationMeta, getPagination } from "../../lib/pagination.js";
import {
  canonicalizeTemplateContent,
  templateContentV2Schema,
  type TemplateContentV2,
} from "../../lib/template-content.js";
import { clonePublishedTemplate } from "./template-clone.service.js";
import { getCloneJob, retryCloneJob } from "./clone-jobs.service.js";
import type {
  CloneTemplateInput,
  CreateTemplateInput,
  ListTemplatesQuery,
  UpdateTemplateInput,
} from "./templates.schemas.js";

type Actor = { userId: string; roleKey: string };

function starterContent(): TemplateContentV2 {
  return {
    schemaVersion: 2,
    project: {
      status: "ACTIVE",
      priority: "MEDIUM",
      visibility: "WORKSPACE",
      completionPolicy: "WARN_ONLY",
    },
    memberPlaceholders: [],
    workflow: {
      name: "Standard Delivery",
      stages: [
        {
          key: "backlog",
          name: "Backlog",
          category: "BACKLOG",
          position: 0,
          isInitial: true,
          isTerminal: false,
          isActive: true,
        },
        {
          key: "in-progress",
          name: "In Progress",
          category: "IN_PROGRESS",
          position: 1,
          isInitial: false,
          isTerminal: false,
          isActive: true,
        },
        {
          key: "done",
          name: "Done",
          category: "COMPLETED",
          position: 2,
          isInitial: false,
          isTerminal: true,
          isActive: true,
        },
      ],
      transitions: [
        { fromKey: "backlog", toKey: "in-progress", conditionsJson: {} },
        { fromKey: "in-progress", toKey: "done", conditionsJson: {} },
      ],
    },
    tags: [],
    customFields: [],
    milestones: [],
    tasks: [
      {
        key: "kickoff",
        title: "Project kickoff",
        priority: "MEDIUM",
        stageKey: "backlog",
        startOffsetDays: 0,
        durationDays: 1,
        position: 0,
        checklist: [
          { title: "Confirm scope", position: 0, isCompleted: false },
          { title: "Identify stakeholders", position: 1, isCompleted: false },
        ],
        tagKeys: [],
        customValues: {},
      },
      {
        key: "delivery",
        title: "Execute delivery work",
        priority: "MEDIUM",
        stageKey: "in-progress",
        startOffsetDays: 1,
        durationDays: 5,
        position: 1,
        checklist: [],
        tagKeys: [],
        customValues: {},
      },
    ],
    dependencies: [
      {
        predecessorKey: "kickoff",
        successorKey: "delivery",
        dependencyType: "FINISH_TO_START",
      },
    ],
  };
}

function canonical(value: unknown) {
  const parsed = templateContentV2Schema.safeParse(value);
  if (!parsed.success)
    throw new ValidationError("Invalid template content", {
      issues: parsed.error.issues,
    });
  return canonicalizeTemplateContent(parsed.data);
}

function mapTemplate(template: {
  id: string;
  seriesId: string;
  workspaceId: string | null;
  name: string;
  description: string | null;
  industryCode: string | null;
  version: number;
  visibility: string;
  status: string;
  contentJson: unknown;
  contentSchemaVersion: number;
  contentHash: string | null;
  publishedAt: Date | null;
  supersededAt: Date | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...template,
    contentJson: template.contentJson,
    publishedAt: template.publishedAt?.toISOString() ?? null,
    supersededAt: template.supersededAt?.toISOString() ?? null,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

async function ownedTemplate(workspaceId: string, templateId: string) {
  const template = await prisma.projectTemplate.findFirst({
    where: { id: templateId, workspaceId },
  });
  if (!template) throw new NotFoundError("Template not found");
  return template;
}

export const templatesService = {
  async list(workspaceId: string, query: ListTemplatesQuery) {
    const pagination = getPagination(query);
    const where: Prisma.ProjectTemplateWhereInput = {
      OR: [{ workspaceId }, { visibility: "SYSTEM", status: "PUBLISHED" }],
      ...(query.status ? { status: query.status } : {}),
      ...(query.visibility ? { visibility: query.visibility } : {}),
      ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
    };
    const [total, templates] = await Promise.all([
      prisma.projectTemplate.count({ where }),
      prisma.projectTemplate.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ visibility: "asc" }, { name: "asc" }, { version: "desc" }],
      }),
    ]);
    return {
      items: templates.map(mapTemplate),
      pagination: buildPaginationMeta(query.page, query.pageSize, total),
    };
  },

  async get(workspaceId: string, templateId: string) {
    const template = await prisma.projectTemplate.findFirst({
      where: { id: templateId, OR: [{ workspaceId }, { visibility: "SYSTEM" }] },
    });
    if (!template) throw new NotFoundError("Template not found");
    return mapTemplate(template);
  },

  async create(workspaceId: string, actorId: string, input: CreateTemplateInput) {
    const content = canonical(input.contentJson ?? starterContent());
    const template = await prisma.projectTemplate.create({
      data: {
        workspaceId,
        name: input.name,
        description: input.description,
        industryCode: input.industryCode,
        visibility: input.visibility,
        status: "DRAFT",
        version: 0,
        contentSchemaVersion: 2,
        contentJson: content.content as unknown as Prisma.InputJsonValue,
        contentHash: content.hash,
        createdById: actorId,
      },
    });
    return mapTemplate(template);
  },

  async update(workspaceId: string, templateId: string, input: UpdateTemplateInput) {
    const existing = await prisma.projectTemplate.findFirst({
      where: { id: templateId, workspaceId, status: "DRAFT" },
    });
    if (!existing) throw new NotFoundError("Draft template not found");
    const content = input.contentJson === undefined ? null : canonical(input.contentJson);
    const template = await prisma.projectTemplate.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.industryCode !== undefined ? { industryCode: input.industryCode } : {}),
        ...(content
          ? {
              contentJson: content.content as unknown as Prisma.InputJsonValue,
              contentSchemaVersion: 2,
              contentHash: content.hash,
            }
          : {}),
      },
    });
    return mapTemplate(template);
  },

  async validate(workspaceId: string, templateId: string) {
    const template = await ownedTemplate(workspaceId, templateId);
    const result = canonical(template.contentJson);
    return { valid: true, schemaVersion: 2, contentHash: result.hash };
  },

  async publish(workspaceId: string, templateId: string) {
    const draft = await prisma.projectTemplate.findFirst({
      where: { id: templateId, workspaceId, status: "DRAFT" },
    });
    if (!draft) throw new NotFoundError("Draft template not found");
    const content = canonical(draft.contentJson);
    return prisma.$transaction(async (tx) => {
      const latest = await tx.projectTemplate.aggregate({
        where: { seriesId: draft.seriesId, status: { in: ["PUBLISHED", "ARCHIVED"] }, version: { gt: 0 } },
        _max: { version: true },
      });
      const now = new Date();
      await tx.projectTemplate.updateMany({
        where: { seriesId: draft.seriesId, status: "PUBLISHED", supersededAt: null },
        data: { status: "ARCHIVED", supersededAt: now },
      });
      const published = await tx.projectTemplate.create({
        data: {
          seriesId: draft.seriesId,
          workspaceId,
          name: draft.name,
          description: draft.description,
          industryCode: draft.industryCode,
          version: (latest._max.version ?? 0) + 1,
          visibility: draft.visibility,
          status: "PUBLISHED",
          contentSchemaVersion: 2,
          contentJson: content.content as unknown as Prisma.InputJsonValue,
          contentHash: content.hash,
          publishedAt: now,
          createdById: draft.createdById,
        },
      });
      return mapTemplate(published);
    });
  },

  async archive(workspaceId: string, templateId: string) {
    const template = await ownedTemplate(workspaceId, templateId);
    const updated = await prisma.projectTemplate.update({
      where: { id: template.id },
      data: {
        status: "ARCHIVED",
        ...(template.status === "PUBLISHED" ? { supersededAt: new Date() } : {}),
      },
    });
    return mapTemplate(updated);
  },

  async duplicate(workspaceId: string, templateId: string, actorId: string) {
    const source = await this.get(workspaceId, templateId);
    return this.create(workspaceId, actorId, {
      name: `${source.name} (copy)`,
      description: source.description ?? undefined,
      industryCode: source.industryCode ?? undefined,
      visibility: "WORKSPACE",
      contentJson: source.contentJson,
    });
  },

  async createVersion(workspaceId: string, templateId: string, actorId: string) {
    const source = await ownedTemplate(workspaceId, templateId);
    const existingDraft = await prisma.projectTemplate.findFirst({
      where: { seriesId: source.seriesId, status: "DRAFT" },
    });
    if (existingDraft) return mapTemplate(existingDraft);
    const versionZero = await prisma.projectTemplate.findUnique({
      where: { seriesId_version: { seriesId: source.seriesId, version: 0 } },
    });
    const data = {
      name: source.name,
      description: source.description,
      industryCode: source.industryCode,
      visibility: source.visibility,
      status: "DRAFT" as const,
      contentJson: source.contentJson as Prisma.InputJsonValue,
      contentSchemaVersion: 2,
      contentHash: source.contentHash,
      publishedAt: null,
      supersededAt: null,
      createdById: actorId,
    };
    const draft = versionZero
      ? await prisma.projectTemplate.update({ where: { id: versionZero.id }, data })
      : await prisma.projectTemplate.create({
          data: { ...data, workspaceId, seriesId: source.seriesId, version: 0 },
        });
    return mapTemplate(draft);
  },

  async versions(workspaceId: string, templateId: string) {
    const source = await ownedTemplate(workspaceId, templateId);
    const versions = await prisma.projectTemplate.findMany({
      where: { seriesId: source.seriesId },
      orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
    });
    return versions.map(mapTemplate);
  },

  clone(workspaceId: string, templateId: string, actor: Actor, input: CloneTemplateInput) {
    return clonePublishedTemplate(workspaceId, templateId, actor, input);
  },

  getCloneJob,
  retryCloneJob,
};

export async function ensureSystemTemplates() {
  const existing = await prisma.projectTemplate.count({
    where: { visibility: "SYSTEM", status: "PUBLISHED" },
  });
  if (existing > 0) return;
  const content = canonical(starterContent());
  await prisma.projectTemplate.create({
    data: {
      workspaceId: null,
      name: "Standard Delivery",
      description: "Kickoff and delivery tasks with a default workflow",
      industryCode: "general",
      version: 1,
      visibility: "SYSTEM",
      status: "PUBLISHED",
      contentSchemaVersion: 2,
      contentJson: content.content as unknown as Prisma.InputJsonValue,
      contentHash: content.hash,
      publishedAt: new Date(),
    },
  });
}

export { claimPendingCloneJobs, processCloneJob } from "./clone-jobs.service.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { buildPaginationMeta, getPagination } from "../../lib/pagination.js";
import { DEFAULT_PROJECT_STAGES, createDefaultProjectWorkflow } from "../../lib/project-workflow.js";
import { legacyStatusForStage } from "../../lib/workflow-runtime.js";
import { nextRankAfter } from "../../lib/rank.js";
import type { TemplateContent } from "./templates.schemas.js";

const SYNC_TASK_THRESHOLD = 100;

type Actor = { userId: string; roleKey: string };

function mapTemplate(template: {
  id: string;
  workspaceId: string | null;
  name: string;
  description: string | null;
  industryCode: string | null;
  version: number;
  visibility: string;
  status: string;
  contentJson: unknown;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: template.id,
    workspaceId: template.workspaceId,
    name: template.name,
    description: template.description,
    industryCode: template.industryCode,
    version: template.version,
    visibility: template.visibility,
    status: template.status,
    contentJson: template.contentJson ?? {},
    createdById: template.createdById,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

function defaultStarterContent(): TemplateContent {
  const stages = DEFAULT_PROJECT_STAGES.map((stage, index) => ({
    key: `stage-${index}`,
    name: stage.name,
    category: stage.category,
    color: stage.color,
    isInitial: stage.isInitial,
    isTerminal: stage.isTerminal,
    position: index,
  }));
  const keys = stages.map((stage) => stage.key);
  const transitions: TemplateContent["workflow"] extends infer W
    ? W extends { transitions: infer T }
      ? T
      : never
    : never = [];
  const add = (from: string, to: string) => {
    transitions.push({ fromKey: from, toKey: to });
  };
  add(keys[0]!, keys[1]!);
  add(keys[1]!, keys[2]!);
  add(keys[1]!, keys[4]!);
  add(keys[2]!, keys[4]!);
  return {
    project: { status: "ACTIVE", priority: "MEDIUM", completionPolicy: "WARN_ONLY" },
    workflow: { name: "Standard Delivery", stages, transitions },
    tasks: [
      {
        key: "kickoff",
        title: "Project kickoff",
        stageKey: keys[0],
        startOffsetDays: 0,
        durationDays: 1,
        checklist: ["Confirm scope", "Identify stakeholders"],
      },
      {
        key: "delivery",
        title: "Execute delivery work",
        stageKey: keys[1],
        startOffsetDays: 1,
        durationDays: 5,
        dependencyKeys: ["kickoff"],
      },
    ],
  };
}

export async function executeTemplateClone(params: {
  workspaceId: string;
  templateId: string;
  actorId: string;
  projectName: string;
  projectCode?: string;
  startAt?: string;
  cloneJobId?: string;
  onProgress?: (progress: number) => Promise<void>;
}) {
  const template = await prisma.projectTemplate.findFirst({
    where: {
      id: params.templateId,
      status: "PUBLISHED",
      OR: [{ workspaceId: params.workspaceId }, { visibility: "SYSTEM" }],
    },
  });
  if (!template) throw new NotFoundError("Published template not found");

  const content = (template.contentJson ?? {}) as TemplateContent;
  const projectStart = params.startAt ? new Date(params.startAt) : new Date();
  const taskDefs = content.tasks ?? [];

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        workspaceId: params.workspaceId,
        name: params.projectName,
        code: params.projectCode,
        description: content.project?.description ?? template.description,
        status: (content.project?.status as "ACTIVE") ?? "ACTIVE",
        priority: (content.project?.priority as "MEDIUM") ?? "MEDIUM",
        completionPolicy:
          (content.project?.completionPolicy as "WARN_ONLY") ?? "WARN_ONLY",
        startAt: projectStart,
        createdById: params.actorId,
        members: {
          create: {
            workspaceId: params.workspaceId,
            userId: params.actorId,
            projectRole: "PROJECT_OWNER",
            addedById: params.actorId,
          },
        },
      },
    });

    const stageKeyToId = new Map<string, string>();
    if (content.workflow?.stages?.length) {
      const workflow = await tx.workflow.create({
        data: {
          workspaceId: params.workspaceId,
          sourceProjectId: project.id,
          name: content.workflow.name,
          version: 1,
          status: "PUBLISHED",
          createdById: params.actorId,
        },
      });
      for (const stageDef of content.workflow.stages) {
        const stage = await tx.workflowStage.create({
          data: {
            workflowId: workflow.id,
            name: stageDef.name,
            category: stageDef.category as Prisma.WorkflowStageCreateInput["category"],
            color: stageDef.color ?? null,
            position: stageDef.position,
            isInitial: stageDef.isInitial ?? false,
            isTerminal: stageDef.isTerminal ?? false,
          },
        });
        stageKeyToId.set(stageDef.key, stage.id);
      }
      for (const transition of content.workflow.transitions ?? []) {
        const fromStageId = stageKeyToId.get(transition.fromKey);
        const toStageId = stageKeyToId.get(transition.toKey);
        if (!fromStageId || !toStageId) continue;
        await tx.workflowTransition.create({
          data: { workflowId: workflow.id, fromStageId, toStageId },
        });
      }
      await tx.projectWorkflow.create({
        data: {
          projectId: project.id,
          workflowId: workflow.id,
          workflowVersion: workflow.version,
        },
      });
    } else {
      await createDefaultProjectWorkflow(tx, {
        workspaceId: params.workspaceId,
        projectId: project.id,
        projectName: project.name,
        actorId: params.actorId,
      });
      const applied = await tx.projectWorkflow.findUniqueOrThrow({
        where: { projectId: project.id },
        include: { workflow: { include: { stages: true } } },
      });
      for (const stage of applied.workflow.stages) {
        stageKeyToId.set(stage.name.toLowerCase().replace(/\s+/g, "-"), stage.id);
      }
    }

    const taskKeyToId = new Map<string, string>();
    const counter = await tx.workspaceTaskCounter.upsert({
      where: { workspaceId: params.workspaceId },
      create: { workspaceId: params.workspaceId, nextNumber: taskDefs.length + 1 },
      update: { nextNumber: { increment: taskDefs.length } },
    });
    let taskNumber = counter.nextNumber - taskDefs.length;

    for (let index = 0; index < taskDefs.length; index += 1) {
      const def = taskDefs[index]!;
      const stageId =
        (def.stageKey ? stageKeyToId.get(def.stageKey) : null) ??
        [...stageKeyToId.values()][0] ??
        null;
      const stage = stageId
        ? await tx.workflowStage.findUnique({ where: { id: stageId } })
        : null;
      const status = stage ? legacyStatusForStage(stage) : "TODO";
      const startAt =
        def.startOffsetDays != null
          ? new Date(projectStart.getTime() + def.startOffsetDays * 86400000)
          : null;
      const dueDate =
        startAt && def.durationDays != null
          ? new Date(startAt.getTime() + def.durationDays * 86400000)
          : null;

      const task = await tx.task.create({
        data: {
          workspaceId: params.workspaceId,
          taskNumber: taskNumber++,
          projectId: project.id,
          title: def.title,
          description: def.description,
          priority: (def.priority as "MEDIUM") ?? "MEDIUM",
          status,
          workflowStageId: stageId,
          startAt,
          dueDate,
          rank: nextRankAfter(undefined),
          createdById: params.actorId,
          assigneeId: params.actorId,
          riskRecalculateAt: new Date(),
        },
      });
      taskKeyToId.set(def.key, task.id);

      for (const [itemIndex, itemTitle] of (def.checklist ?? []).entries()) {
        await tx.checklistItem.create({
          data: {
            taskId: task.id,
            title: itemTitle,
            position: itemIndex,
            createdById: params.actorId,
          },
        });
      }

      if (params.onProgress && taskDefs.length > 0) {
        await params.onProgress(Math.round(((index + 1) / taskDefs.length) * 100));
      }
    }

    for (const def of taskDefs) {
      const taskId = taskKeyToId.get(def.key);
      if (!taskId) continue;
      for (const depKey of def.dependencyKeys ?? []) {
        const predecessorId = taskKeyToId.get(depKey);
        if (!predecessorId) continue;
        await tx.taskDependency.create({
          data: {
            workspaceId: params.workspaceId,
            predecessorTaskId: predecessorId,
            successorTaskId: taskId,
            createdById: params.actorId,
          },
        });
      }
    }

    if (params.cloneJobId) {
      await tx.cloneJob.update({
        where: { id: params.cloneJobId },
        data: {
          projectId: project.id,
          status: "COMPLETED",
          progress: 100,
          completedAt: new Date(),
          resultJson: { projectId: project.id, taskCount: taskDefs.length },
        },
      });
    }

    return { projectId: project.id, taskCount: taskDefs.length };
  });
}

export const templatesService = {
  async list(workspaceId: string, query: import("./templates.schemas.js").ListTemplatesQuery) {
    const pagination = getPagination(query);
    const where: Prisma.ProjectTemplateWhereInput = {
      OR: [{ workspaceId }, { visibility: "SYSTEM", status: "PUBLISHED" }],
      ...(query.status ? { status: query.status } : {}),
      ...(query.visibility ? { visibility: query.visibility } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: "insensitive" } }
        : {}),
    };
    const [total, templates] = await Promise.all([
      prisma.projectTemplate.count({ where }),
      prisma.projectTemplate.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ visibility: "asc" }, { name: "asc" }, { version: "desc" }],
      }),
    ]);
    return {
      items: templates.map(mapTemplate),
      pagination: buildPaginationMeta(query.page, query.pageSize, total),
    };
  },

  async get(workspaceId: string, templateId: string) {
    const template = await prisma.projectTemplate.findFirst({
      where: {
        id: templateId,
        OR: [{ workspaceId }, { visibility: "SYSTEM" }],
      },
    });
    if (!template) throw new NotFoundError("Template not found");
    return mapTemplate(template);
  },

  async create(workspaceId: string, actorId: string, input: import("./templates.schemas.js").CreateTemplateInput) {
    const template = await prisma.projectTemplate.create({
      data: {
        workspaceId,
        name: input.name,
        description: input.description,
        industryCode: input.industryCode,
        visibility: input.visibility,
        status: "DRAFT",
        contentJson: (input.contentJson ?? defaultStarterContent()) as Prisma.InputJsonValue,
        createdById: actorId,
      },
    });
    return mapTemplate(template);
  },

  async update(
    workspaceId: string,
    templateId: string,
    input: import("./templates.schemas.js").UpdateTemplateInput,
  ) {
    const existing = await prisma.projectTemplate.findFirst({
      where: { id: templateId, workspaceId, status: "DRAFT" },
    });
    if (!existing) throw new NotFoundError("Draft template not found");
    const template = await prisma.projectTemplate.update({
      where: { id: templateId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.industryCode !== undefined ? { industryCode: input.industryCode } : {}),
        ...(input.contentJson !== undefined
          ? { contentJson: input.contentJson as Prisma.InputJsonValue }
          : {}),
      },
    });
    return mapTemplate(template);
  },

  async publish(workspaceId: string, templateId: string) {
    const draft = await prisma.projectTemplate.findFirst({
      where: { id: templateId, workspaceId, status: "DRAFT" },
    });
    if (!draft) throw new NotFoundError("Draft template not found");

    const latest = await prisma.projectTemplate.aggregate({
      where: { workspaceId, name: draft.name },
      _max: { version: true },
    });
    const nextVersion = (latest._max.version ?? 0) + 1;

    const published = await prisma.$transaction(async (tx) => {
      const created = await tx.projectTemplate.create({
        data: {
          workspaceId,
          name: draft.name,
          description: draft.description,
          industryCode: draft.industryCode,
          version: nextVersion,
          visibility: draft.visibility,
          status: "PUBLISHED",
          contentJson: draft.contentJson as Prisma.InputJsonValue,
          createdById: draft.createdById,
        },
      });
      await tx.projectTemplate.update({
        where: { id: draft.id },
        data: { status: "ARCHIVED" },
      });
      return created;
    });
    return mapTemplate(published);
  },

  async archive(workspaceId: string, templateId: string) {
    const template = await prisma.projectTemplate.findFirst({
      where: { id: templateId, workspaceId },
    });
    if (!template) throw new NotFoundError("Template not found");
    const updated = await prisma.projectTemplate.update({
      where: { id: templateId },
      data: { status: "ARCHIVED" },
    });
    return mapTemplate(updated);
  },

  async duplicate(workspaceId: string, templateId: string, actorId: string) {
    const source = await this.get(workspaceId, templateId);
    return this.create(workspaceId, actorId, {
      name: `${source.name} (copy)`,
      description: source.description ?? undefined,
      industryCode: source.industryCode ?? undefined,
      visibility: "WORKSPACE",
      contentJson: source.contentJson as Record<string, unknown>,
    });
  },

  async clone(
    workspaceId: string,
    templateId: string,
    actor: Actor,
    input: import("./templates.schemas.js").CloneTemplateInput,
  ) {
    const template = await this.get(workspaceId, templateId);
    if (template.status !== "PUBLISHED") {
      throw new ValidationError("Only published templates can be cloned");
    }

    const existingJob = await prisma.cloneJob.findUnique({
      where: {
        workspaceId_idempotencyKey: {
          workspaceId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existingJob) {
      if (existingJob.status === "COMPLETED" && existingJob.projectId) {
        return { mode: "existing" as const, cloneJobId: existingJob.id, projectId: existingJob.projectId };
      }
      return { mode: "existing" as const, cloneJobId: existingJob.id, projectId: existingJob.projectId };
    }

    const content = template.contentJson as TemplateContent;
    const taskCount = content.tasks?.length ?? 0;
    const useAsync = taskCount > SYNC_TASK_THRESHOLD;

    if (!useAsync) {
      const result = await executeTemplateClone({
        workspaceId,
        templateId,
        actorId: actor.userId,
        projectName: input.projectName,
        projectCode: input.projectCode,
        startAt: input.startAt,
      });
      const job = await prisma.cloneJob.create({
        data: {
          workspaceId,
          templateId,
          projectId: result.projectId,
          status: "COMPLETED",
          idempotencyKey: input.idempotencyKey,
          progress: 100,
          createdById: actor.userId,
          completedAt: new Date(),
          resultJson: result,
        },
      });
      return { mode: "sync" as const, cloneJobId: job.id, projectId: result.projectId };
    }

    const job = await prisma.cloneJob.create({
      data: {
        workspaceId,
        templateId,
        status: "PENDING",
        idempotencyKey: input.idempotencyKey,
        createdById: actor.userId,
        resultJson: {
          projectName: input.projectName,
          projectCode: input.projectCode,
          startAt: input.startAt,
        },
      },
    });
    return { mode: "async" as const, cloneJobId: job.id, projectId: null };
  },

  async getCloneJob(workspaceId: string, cloneJobId: string) {
    const job = await prisma.cloneJob.findFirst({
      where: { id: cloneJobId, workspaceId },
    });
    if (!job) throw new NotFoundError("Clone job not found");
    return {
      id: job.id,
      templateId: job.templateId,
      projectId: job.projectId,
      status: job.status,
      progress: job.progress,
      errorMessage: job.errorMessage,
      resultJson: job.resultJson,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
    };
  },
};

export async function claimPendingCloneJobs(limit: number) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "clone_jobs"
      WHERE "status" = 'PENDING'
      ORDER BY "createdAt"
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    `;
    for (const row of rows) {
      await tx.cloneJob.update({
        where: { id: row.id },
        data: { status: "PROCESSING", startedAt: new Date() },
      });
    }
    return rows.map((row) => row.id);
  });
}

export async function processCloneJob(cloneJobId: string) {
  const job = await prisma.cloneJob.findUnique({ where: { id: cloneJobId } });
  if (!job || job.status !== "PROCESSING") return;

  try {
    const payload = (job.resultJson ?? {}) as { projectName?: string; projectCode?: string; startAt?: string };
    await executeTemplateClone({
      workspaceId: job.workspaceId,
      templateId: job.templateId,
      actorId: job.createdById ?? job.workspaceId,
      projectName: payload.projectName ?? "Cloned project",
      projectCode: payload.projectCode,
      startAt: payload.startAt,
      cloneJobId: job.id,
      onProgress: async (progress) => {
        await prisma.cloneJob.update({ where: { id: job.id }, data: { progress } });
      },
    });
  } catch (error) {
    await prisma.cloneJob.update({
      where: { id: cloneJobId },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Clone failed",
        completedAt: new Date(),
      },
    });
  }
}

export async function ensureSystemTemplates() {
  const existing = await prisma.projectTemplate.count({
    where: { visibility: "SYSTEM", status: "PUBLISHED" },
  });
  if (existing > 0) return;

  await prisma.projectTemplate.create({
    data: {
      workspaceId: null,
      name: "Standard Delivery",
      description: "Kickoff and delivery tasks with a default workflow",
      industryCode: "general",
      version: 1,
      visibility: "SYSTEM",
      status: "PUBLISHED",
      contentJson: defaultStarterContent() as Prisma.InputJsonValue,
    },
  });
}

import type { Prisma, ProjectTemplate } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { buildPaginationMeta, getPagination } from "../../lib/pagination.js";
import {
  canonicalizeTemplateContent,
  templateContentV2Schema,
  type TemplateContentV2,
} from "../../lib/template-content.js";
import { getCloneJob, retryCloneJob } from "./clone-jobs.service.js";
import { clonePublishedTemplate } from "./template-clone.service.js";
import type {
  CloneTemplateInput,
  CreateTemplateInput,
  ListTemplatesQuery,
  UpdateTemplateInput,
} from "./templates.schemas.js";

const starter = (): TemplateContentV2 => ({
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
      { key: "backlog", name: "Backlog", category: "BACKLOG", position: 0, isInitial: true, isTerminal: false, isActive: true },
      { key: "active", name: "In Progress", category: "IN_PROGRESS", position: 1, isInitial: false, isTerminal: false, isActive: true },
      { key: "done", name: "Done", category: "COMPLETED", position: 2, isInitial: false, isTerminal: true, isActive: true },
    ],
    transitions: [
      { fromKey: "backlog", toKey: "active", conditionsJson: {} },
      { fromKey: "active", toKey: "done", conditionsJson: {} },
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
      position: 0,
      startOffsetDays: 0,
      durationDays: 1,
      checklist: [{ title: "Confirm scope", position: 0, isCompleted: false }],
      tagKeys: [],
      customValues: {},
    },
  ],
  dependencies: [],
});

function content(value: unknown) {
  const result = templateContentV2Schema.safeParse(value);
  if (!result.success)
    throw new ValidationError("Invalid template content", { issues: result.error.issues });
  return canonicalizeTemplateContent(result.data);
}

const mapped = (row: ProjectTemplate) => ({
  ...row,
  publishedAt: row.publishedAt?.toISOString() ?? null,
  supersededAt: row.supersededAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

async function visible(workspaceId: string, templateId: string) {
  const row = await prisma.projectTemplate.findFirst({
    where: { id: templateId, OR: [{ workspaceId }, { visibility: "SYSTEM" }] },
  });
  if (!row) throw new NotFoundError("Template not found");
  return row;
}

async function owned(workspaceId: string, templateId: string) {
  const row = await prisma.projectTemplate.findFirst({ where: { id: templateId, workspaceId } });
  if (!row) throw new NotFoundError("Template not found");
  return row;
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
    const [total, rows] = await Promise.all([
      prisma.projectTemplate.count({ where }),
      prisma.projectTemplate.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ name: "asc" }, { version: "desc" }],
      }),
    ]);
    return { items: rows.map(mapped), pagination: buildPaginationMeta(query.page, query.pageSize, total) };
  },
  async get(workspaceId: string, templateId: string) {
    return mapped(await visible(workspaceId, templateId));
  },
  async create(workspaceId: string, actorId: string, input: CreateTemplateInput) {
    const parsed = content(input.contentJson ?? starter());
    return mapped(
      await prisma.projectTemplate.create({
        data: {
          workspaceId,
          name: input.name,
          description: input.description,
          industryCode: input.industryCode,
          visibility: input.visibility,
          status: "DRAFT",
          version: 0,
          contentSchemaVersion: 2,
          contentJson: parsed.content as unknown as Prisma.InputJsonValue,
          contentHash: parsed.hash,
          createdById: actorId,
        },
      }),
    );
  },
  async update(workspaceId: string, templateId: string, input: UpdateTemplateInput) {
    const draft = await prisma.projectTemplate.findFirst({
      where: { id: templateId, workspaceId, status: "DRAFT" },
    });
    if (!draft) throw new NotFoundError("Draft template not found");
    const parsed = input.contentJson ? content(input.contentJson) : null;
    return mapped(
      await prisma.projectTemplate.update({
        where: { id: draft.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.industryCode !== undefined ? { industryCode: input.industryCode } : {}),
          ...(parsed
            ? {
                contentJson: parsed.content as unknown as Prisma.InputJsonValue,
                contentHash: parsed.hash,
                contentSchemaVersion: 2,
              }
            : {}),
        },
      }),
    );
  },
  async validate(workspaceId: string, templateId: string) {
    const parsed = content((await owned(workspaceId, templateId)).contentJson);
    return { valid: true, schemaVersion: 2, contentHash: parsed.hash };
  },
  async publish(workspaceId: string, templateId: string) {
    const draft = await prisma.projectTemplate.findFirst({
      where: { id: templateId, workspaceId, status: "DRAFT" },
    });
    if (!draft) throw new NotFoundError("Draft template not found");
    const parsed = content(draft.contentJson);
    return prisma.$transaction(async (tx) => {
      const latest = await tx.projectTemplate.aggregate({
        where: { seriesId: draft.seriesId, version: { gt: 0 } },
        _max: { version: true },
      });
      const now = new Date();
      await tx.projectTemplate.updateMany({
        where: { seriesId: draft.seriesId, status: "PUBLISHED", supersededAt: null },
        data: { status: "ARCHIVED", supersededAt: now },
      });
      return mapped(
        await tx.projectTemplate.create({
          data: {
            seriesId: draft.seriesId,
            workspaceId,
            name: draft.name,
            description: draft.description,
            industryCode: draft.industryCode,
            visibility: draft.visibility,
            version: (latest._max.version ?? 0) + 1,
            status: "PUBLISHED",
            contentSchemaVersion: 2,
            contentJson: parsed.content as unknown as Prisma.InputJsonValue,
            contentHash: parsed.hash,
            publishedAt: now,
            createdById: draft.createdById,
          },
        }),
      );
    });
  },
  async archive(workspaceId: string, templateId: string) {
    const row = await owned(workspaceId, templateId);
    return mapped(
      await prisma.projectTemplate.update({
        where: { id: row.id },
        data: { status: "ARCHIVED", ...(row.status === "PUBLISHED" ? { supersededAt: new Date() } : {}) },
      }),
    );
  },
  async duplicate(workspaceId: string, templateId: string, actorId: string) {
    const row = await visible(workspaceId, templateId);
    return this.create(workspaceId, actorId, {
      name: `${row.name} (copy)`,
      description: row.description ?? undefined,
      industryCode: row.industryCode ?? undefined,
      visibility: "WORKSPACE",
      contentJson: content(row.contentJson).content,
    });
  },
  async createVersion(workspaceId: string, templateId: string, actorId: string) {
    const source = await owned(workspaceId, templateId);
    const current = await prisma.projectTemplate.findFirst({
      where: { seriesId: source.seriesId, status: "DRAFT" },
    });
    if (current) return mapped(current);
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
      contentHash: source.contentHash,
      contentSchemaVersion: 2,
      publishedAt: null,
      supersededAt: null,
      createdById: actorId,
    };
    return mapped(
      versionZero
        ? await prisma.projectTemplate.update({ where: { id: versionZero.id }, data })
        : await prisma.projectTemplate.create({
            data: { ...data, workspaceId, seriesId: source.seriesId, version: 0 },
          }),
    );
  },
  async versions(workspaceId: string, templateId: string) {
    const source = await owned(workspaceId, templateId);
    return (
      await prisma.projectTemplate.findMany({
        where: { seriesId: source.seriesId },
        orderBy: [{ version: "desc" }],
      })
    ).map(mapped);
  },
  clone(
    workspaceId: string,
    templateId: string,
    actor: { userId: string; roleKey: string },
    input: CloneTemplateInput,
  ) {
    return clonePublishedTemplate(workspaceId, templateId, actor, input);
  },
  getCloneJob,
  retryCloneJob,
};

export async function ensureSystemTemplates() {
  if (
    (await prisma.projectTemplate.count({
      where: { visibility: "SYSTEM", status: "PUBLISHED" },
    })) > 0
  )
    return;
  const parsed = content(starter());
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
      contentJson: parsed.content as unknown as Prisma.InputJsonValue,
      contentHash: parsed.hash,
      publishedAt: new Date(),
    },
  });
}

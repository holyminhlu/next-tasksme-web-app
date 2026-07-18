import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../lib/errors.js";
import type {
  CreateSavedViewInput,
  UpdateSavedViewInput,
} from "./saved-views.schemas.js";

type Actor = { userId: string; roleKey: string };

function mapSavedView(view: {
  id: string;
  workspaceId: string;
  ownerUserId: string;
  name: string;
  resourceType: string;
  viewType: string;
  visibility: string;
  filtersJson: Prisma.JsonValue;
  sortJson: Prisma.JsonValue;
  groupByJson: Prisma.JsonValue;
  columnsJson: Prisma.JsonValue;
  displayOptionsJson: Prisma.JsonValue;
  configVersion: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: view.id,
    workspaceId: view.workspaceId,
    ownerUserId: view.ownerUserId,
    name: view.name,
    resourceType: view.resourceType,
    viewType: view.viewType,
    visibility: view.visibility,
    filtersJson: view.filtersJson,
    sortJson: view.sortJson,
    groupByJson: view.groupByJson,
    columnsJson: view.columnsJson,
    displayOptionsJson: view.displayOptionsJson,
    configVersion: view.configVersion,
    isDefault: view.isDefault,
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  };
}

async function getOwnedView(
  workspaceId: string,
  viewId: string,
  actor: Actor,
) {
  const view = await prisma.savedView.findFirst({
    where: { id: viewId, workspaceId },
  });
  if (!view) throw new NotFoundError("Saved view not found");
  if (view.ownerUserId !== actor.userId) {
    throw new ForbiddenError("Saved views are private to their owner");
  }
  return view;
}

export class SavedViewsService {
  async list(workspaceId: string, actor: Actor) {
    const items = await prisma.savedView.findMany({
      where: {
        workspaceId,
        ownerUserId: actor.userId,
        visibility: "PRIVATE",
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
    return items.map(mapSavedView);
  }

  async create(
    workspaceId: string,
    actor: Actor,
    input: CreateSavedViewInput,
  ) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        if (input.isDefault) {
          await tx.savedView.updateMany({
            where: {
              workspaceId,
              ownerUserId: actor.userId,
              isDefault: true,
            },
            data: { isDefault: false },
          });
        }
        return tx.savedView.create({
          data: {
            workspaceId,
            ownerUserId: actor.userId,
            name: input.name,
            viewType: input.viewType,
            filtersJson: input.filtersJson,
            sortJson: input.sortJson,
            groupByJson: input.groupByJson,
            columnsJson: input.columnsJson,
            displayOptionsJson: input.displayOptionsJson,
            isDefault: input.isDefault ?? false,
          },
        });
      });
      return mapSavedView(created);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        throw new ConflictError("A saved view with this name already exists");
      }
      throw error;
    }
  }

  async update(
    workspaceId: string,
    viewId: string,
    actor: Actor,
    input: UpdateSavedViewInput,
  ) {
    await getOwnedView(workspaceId, viewId, actor);
    try {
      const updated = await prisma.$transaction(async (tx) => {
        if (input.isDefault === true) {
          await tx.savedView.updateMany({
            where: {
              workspaceId,
              ownerUserId: actor.userId,
              isDefault: true,
              NOT: { id: viewId },
            },
            data: { isDefault: false },
          });
        }
        return tx.savedView.update({
          where: { id: viewId },
          data: {
            name: input.name,
            viewType: input.viewType,
            filtersJson: input.filtersJson,
            sortJson: input.sortJson,
            groupByJson: input.groupByJson,
            columnsJson: input.columnsJson,
            displayOptionsJson: input.displayOptionsJson,
            isDefault: input.isDefault,
            configVersion: { increment: 1 },
          },
        });
      });
      return mapSavedView(updated);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        throw new ConflictError("A saved view with this name already exists");
      }
      throw error;
    }
  }

  async remove(workspaceId: string, viewId: string, actor: Actor) {
    await getOwnedView(workspaceId, viewId, actor);
    await prisma.savedView.delete({ where: { id: viewId } });
    return { id: viewId, deleted: true };
  }

  async get(workspaceId: string, viewId: string, actor: Actor) {
    return mapSavedView(await getOwnedView(workspaceId, viewId, actor));
  }
}

export const savedViewsService = new SavedViewsService();

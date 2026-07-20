import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import { NotFoundError } from "../../lib/errors.js";
import { assertSlaEnabled } from "../sla/sla.service.js";
import { writeAuditLog } from "../../services/audit.service.js";

export type BusinessCalendarMutation = {
  name: string;
  timezone: string;
  isDefault?: boolean;
  isActive?: boolean;
  workingHours?: Array<{ dayOfWeek: number; startMinute: number; endMinute: number }>;
  holidays?: Array<{ date: string; name: string; isWorking?: boolean }>;
};

const include = { workingHours: true, holidays: true } satisfies Prisma.BusinessCalendarInclude;

export class BusinessCalendarsService {
  async list(workspaceId: string) {
    await assertSlaEnabled(workspaceId);
    return prisma.businessCalendar.findMany({
      where: { workspaceId },
      include,
      orderBy: { createdAt: "asc" },
    });
  }

  async get(workspaceId: string, id: string) {
    await assertSlaEnabled(workspaceId);
    const calendar = await prisma.businessCalendar.findFirst({
      where: { id, workspaceId },
      include,
    });
    if (!calendar) throw new NotFoundError("Business calendar not found");
    return calendar;
  }

  async create(workspaceId: string, userId: string, input: BusinessCalendarMutation) {
    await assertSlaEnabled(workspaceId);
    return prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.businessCalendar.updateMany({
          where: { workspaceId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.businessCalendar.create({
        data: {
          workspaceId,
          createdById: userId,
          name: input.name,
          timezone: input.timezone,
          isDefault: input.isDefault ?? false,
          isActive: input.isActive ?? true,
          workingHours: { create: input.workingHours ?? [] },
          holidays: {
            create: (input.holidays ?? []).map((holiday) => ({
              ...holiday,
              date: new Date(`${holiday.date}T00:00:00.000Z`),
              isWorking: holiday.isWorking ?? false,
            })),
          },
        },
        include,
      });
    }).then(async (calendar) => {
      await writeAuditLog({
        action: "business_calendar.created",
        userId,
        workspaceId,
        entityType: "business_calendar",
        entityId: calendar.id,
        metadata: { name: calendar.name },
      });
      return calendar;
    });
  }

  async update(workspaceId: string, id: string, userId: string, input: Partial<BusinessCalendarMutation>) {
    await this.get(workspaceId, id);
    return prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.businessCalendar.updateMany({
          where: { workspaceId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }
      if (input.workingHours) {
        await tx.workingHours.deleteMany({ where: { calendarId: id } });
      }
      if (input.holidays) await tx.holiday.deleteMany({ where: { calendarId: id } });
      return tx.businessCalendar.update({
        where: { id },
        data: {
          name: input.name,
          timezone: input.timezone,
          isDefault: input.isDefault,
          isActive: input.isActive,
          workingHours: input.workingHours ? { create: input.workingHours } : undefined,
          holidays: input.holidays
            ? {
                create: input.holidays.map((holiday) => ({
                  ...holiday,
                  date: new Date(`${holiday.date}T00:00:00.000Z`),
                  isWorking: holiday.isWorking ?? false,
                })),
              }
            : undefined,
        },
        include,
      });
    }).then(async (calendar) => {
      await writeAuditLog({
        action: "business_calendar.updated",
        userId,
        workspaceId,
        entityType: "business_calendar",
        entityId: id,
      });
      return calendar;
    });
  }

  async remove(workspaceId: string, id: string, userId: string) {
    await this.get(workspaceId, id);
    await prisma.businessCalendar.delete({ where: { id } });
    await writeAuditLog({
      action: "business_calendar.deleted",
      userId,
      workspaceId,
      entityType: "business_calendar",
      entityId: id,
    });
    return { deleted: true };
  }
}

export const businessCalendarsService = new BusinessCalendarsService();

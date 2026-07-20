import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import type { Prisma } from "../../../generated/prisma/client.js";
import { sendSuccess } from "../../lib/response.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { tenantContext } from "../../middleware/tenantContext.js";
import { validateRequest } from "../../middleware/validate.js";
import { actorFromRequest } from "../tasks/task-access.js";
import { slaService } from "./sla.service.js";

const params = z.object({
  workspaceId: z.string().uuid(),
  policyId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  instanceId: z.string().uuid().optional(),
});
const policyBody = z.object({
  name: z.string().min(1).max(100),
  targetDurationMinutes: z.number().int().positive(),
  warningBeforeMinutes: z.number().int().nonnegative(),
  applicableConditions: z.record(z.string(), z.unknown()).default({}),
  businessCalendarId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const slaPoliciesRouter = Router({ mergeParams: true });
slaPoliciesRouter.use(authenticate);
slaPoliciesRouter.get(
  "/",
  validateRequest({ params }),
  tenantContext,
  requirePermission("sla.view"),
  async (req, res, next) => {
    try {
      sendSuccess(res, await slaService.listPolicies(String(req.params.workspaceId)));
    } catch (error) {
      next(error);
    }
  },
);
slaPoliciesRouter.post(
  "/",
  validateRequest({ params, body: policyBody }),
  tenantContext,
  requirePermission("sla.configure"),
  async (req, res, next) => {
    try {
      const input = req.body as z.infer<typeof policyBody>;
      sendSuccess(
        res,
        await slaService.createPolicy(
          String(req.params.workspaceId),
          actorFromRequest(req).userId,
          {
            ...input,
            applicableConditions: input.applicableConditions as Prisma.InputJsonValue,
          },
        ),
        { statusCode: 201 },
      );
    } catch (error) {
      next(error);
    }
  },
);
for (const method of ["patch", "put"] as const) {
  slaPoliciesRouter[method](
    "/:policyId",
    validateRequest({ params, body: method === "patch" ? policyBody.partial() : policyBody }),
    tenantContext,
    requirePermission("sla.configure"),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const input = req.body as Partial<z.infer<typeof policyBody>>;
        const data: Prisma.SlaPolicyUpdateInput = {
          name: input.name,
          targetDurationMinutes: input.targetDurationMinutes,
          warningBeforeMinutes: input.warningBeforeMinutes,
          applicableConditionsJson: input.applicableConditions as Prisma.InputJsonValue,
          businessCalendar: input.businessCalendarId
            ? { connect: { id: input.businessCalendarId } }
            : input.businessCalendarId === null
              ? { disconnect: true }
              : undefined,
          isActive: input.isActive,
        };
        sendSuccess(
          res,
          await slaService.updatePolicy(
            String(req.params.workspaceId),
            String(req.params.policyId),
            data,
          ),
        );
      } catch (error) {
        next(error);
      }
    },
  );
}
slaPoliciesRouter.delete(
  "/:policyId",
  validateRequest({ params }),
  tenantContext,
  requirePermission("sla.configure"),
  async (req, res, next) => {
    try {
      sendSuccess(
        res,
        await slaService.deletePolicy(
          String(req.params.workspaceId),
          String(req.params.policyId),
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);

export const taskSlaRouter = Router({ mergeParams: true });
taskSlaRouter.use(authenticate);
taskSlaRouter.get(
  "/",
  validateRequest({ params }),
  tenantContext,
  requirePermission("sla.view"),
  async (req, res, next) => {
    try {
      sendSuccess(
        res,
        await slaService.taskInstances(
          String(req.params.workspaceId),
          String(req.params.taskId),
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);

export const slaInstancesRouter = Router({ mergeParams: true });
slaInstancesRouter.use(authenticate);
for (const action of ["pause", "resume"] as const) {
  slaInstancesRouter.post(
    `/:instanceId/${action}`,
    validateRequest({ params }),
    tenantContext,
    requirePermission("sla.override"),
    async (req, res, next) => {
      try {
        sendSuccess(
          res,
          await slaService[action](
            String(req.params.workspaceId),
            String(req.params.instanceId),
          ),
        );
      } catch (error) {
        next(error);
      }
    },
  );
}

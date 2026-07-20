import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { sendSuccess } from "../../lib/response.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { tenantContext } from "../../middleware/tenantContext.js";
import { validateRequest } from "../../middleware/validate.js";
import { actorFromRequest } from "../tasks/task-access.js";
import { riskService } from "./risk.service.js";

const workspaceParams = z.object({ workspaceId: z.string().uuid() });
const taskParams = workspaceParams.extend({ taskId: z.string().uuid() });
const manualBody = z.object({
  manualRiskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).nullable(),
});
const ruleBody = z.object({
  name: z.string().min(1).max(100).default("Default"),
  weights: z.record(z.string(), z.number().nonnegative()),
  thresholds: z.record(z.string(), z.number().nonnegative()),
});
const wrap =
  (action: "get" | "manual" | "getRule" | "upsertRule") =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspaceId = String(req.params.workspaceId);
      const actor = actorFromRequest(req);
      const data =
        action === "get"
          ? await riskService.get(workspaceId, String(req.params.taskId), actor)
          : action === "manual"
            ? await riskService.setManual(
                workspaceId,
                String(req.params.taskId),
                actor,
                (req.body as z.infer<typeof manualBody>).manualRiskLevel,
              )
            : action === "getRule"
              ? await riskService.getRule(workspaceId)
              : await riskService.upsertRule(
                  workspaceId,
                  actor.userId,
                  req.body as z.infer<typeof ruleBody>,
                );
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  };

export const taskRiskRouter = Router({ mergeParams: true });
taskRiskRouter.use(authenticate);
taskRiskRouter.get(
  "/",
  validateRequest({ params: taskParams }),
  tenantContext,
  requirePermission("risk.view"),
  wrap("get"),
);
taskRiskRouter.patch(
  "/",
  validateRequest({ params: taskParams, body: manualBody }),
  tenantContext,
  requirePermission("risk.update"),
  wrap("manual"),
);

export const riskRulesRouter = Router({ mergeParams: true });
riskRulesRouter.use(authenticate);
riskRulesRouter.get(
  "/",
  validateRequest({ params: workspaceParams }),
  tenantContext,
  requirePermission("risk.view"),
  wrap("getRule"),
);
for (const method of ["put", "post"] as const) {
  riskRulesRouter[method](
    "/",
    validateRequest({ params: workspaceParams, body: ruleBody }),
    tenantContext,
    requirePermission("risk.configure"),
    wrap("upsertRule"),
  );
}

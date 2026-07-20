import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { sendSuccess } from "../../lib/response.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { tenantContext } from "../../middleware/tenantContext.js";
import { validateRequest } from "../../middleware/validate.js";
import { actorFromRequest } from "../tasks/task-access.js";
import { automationRunsService } from "./automation-runs.service.js";

const params = z.object({ workspaceId: z.string().uuid(), runId: z.string().uuid().optional() });
const query = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["PENDING", "RUNNING", "SUCCEEDED", "FAILED", "SKIPPED", "DEAD"]).optional(),
  taskId: z.string().uuid().optional(),
});
const handler =
  (action: "list" | "get" | "retry") =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspaceId = String(req.params.workspaceId);
      const runId = String(req.params.runId ?? "");
      const actor = actorFromRequest(req);
      const data =
        action === "list"
          ? await automationRunsService.list(
              workspaceId,
              req.query as unknown as z.infer<typeof query>,
            )
          : action === "get"
            ? await automationRunsService.get(workspaceId, runId)
            : await automationRunsService.retry(workspaceId, runId, actor.userId);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  };

export const automationRunsRouter = Router({ mergeParams: true });
automationRunsRouter.use(authenticate);
automationRunsRouter.get(
  "/",
  validateRequest({ params, query }),
  tenantContext,
  requirePermission("automation.view"),
  handler("list"),
);
automationRunsRouter.get(
  "/:runId",
  validateRequest({ params }),
  tenantContext,
  requirePermission("automation.view"),
  handler("get"),
);
automationRunsRouter.post(
  "/:runId/retry",
  validateRequest({ params }),
  tenantContext,
  requirePermission("automation.retry"),
  handler("retry"),
);

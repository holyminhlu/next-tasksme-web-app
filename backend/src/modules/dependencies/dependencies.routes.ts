import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { tenantContext } from "../../middleware/tenantContext.js";
import { validateRequest } from "../../middleware/validate.js";
import {
  createDependency,
  deleteDependency,
  listDependencies,
} from "./dependencies.controller.js";
import {
  createDependencySchema,
  dependencyParamsSchema,
  dependencyTaskParamsSchema,
} from "./dependencies.schemas.js";

export const dependenciesRouter = Router({ mergeParams: true });

dependenciesRouter.use(authenticate);

dependenciesRouter.get(
  "/",
  validateRequest({ params: dependencyTaskParamsSchema }),
  tenantContext,
  requirePermission("task_dependency.view"),
  listDependencies,
);

dependenciesRouter.post(
  "/",
  validateRequest({
    params: dependencyTaskParamsSchema,
    body: createDependencySchema,
  }),
  tenantContext,
  requirePermission("task_dependency.manage"),
  createDependency,
);

dependenciesRouter.delete(
  "/:dependencyId",
  validateRequest({ params: dependencyParamsSchema }),
  tenantContext,
  requirePermission("task_dependency.manage"),
  deleteDependency,
);

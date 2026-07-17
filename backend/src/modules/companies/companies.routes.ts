import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { tenantContext } from "../../middleware/tenantContext.js";
import { validateRequest } from "../../middleware/validate.js";
import { getCompany, listMembers, updateCompany } from "./companies.controller.js";
import {
  companyIdParamsSchema,
  listMembersQuerySchema,
  updateCompanySchema,
} from "./companies.schemas.js";

export const companiesRouter = Router();

companiesRouter.use(authenticate);

companiesRouter.get(
  "/:companyId",
  validateRequest({ params: companyIdParamsSchema }),
  tenantContext,
  requirePermission("company:read"),
  getCompany,
);

companiesRouter.patch(
  "/:companyId",
  validateRequest({
    params: companyIdParamsSchema,
    body: updateCompanySchema,
  }),
  tenantContext,
  requirePermission("company:update"),
  updateCompany,
);

companiesRouter.get(
  "/:companyId/members",
  validateRequest({
    params: companyIdParamsSchema,
    query: listMembersQuerySchema,
  }),
  tenantContext,
  requirePermission("members:read"),
  listMembers,
);

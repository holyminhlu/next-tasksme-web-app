import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { optionalAuthenticate } from "../../middleware/optionalAuthenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { tenantContext } from "../../middleware/tenantContext.js";
import { validateRequest } from "../../middleware/validate.js";
import {
  acceptInvitation,
  getCompany,
  inspectInvitation,
  inviteMember,
  listMembers,
  removeMember,
  revokeInvitation,
  transferOwnership,
  updateCompany,
  updateMemberRole,
} from "./companies.controller.js";
import {
  acceptInvitationSchema,
  companyIdParamsSchema,
  invitationIdParamsSchema,
  inviteMemberSchema,
  listMembersQuerySchema,
  memberIdParamsSchema,
  transferOwnershipSchema,
  updateCompanySchema,
  updateMemberRoleSchema,
} from "./companies.schemas.js";

export const companiesRouter = Router();
export const invitationsRouter = Router();

invitationsRouter.get("/preview", inspectInvitation);
invitationsRouter.post(
  "/accept",
  optionalAuthenticate,
  validateRequest({ body: acceptInvitationSchema }),
  acceptInvitation,
);

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

companiesRouter.post(
  "/:companyId/invitations",
  validateRequest({
    params: companyIdParamsSchema,
    body: inviteMemberSchema,
  }),
  tenantContext,
  requirePermission("members:invite"),
  inviteMember,
);

companiesRouter.delete(
  "/:companyId/invitations/:invitationId",
  validateRequest({ params: invitationIdParamsSchema }),
  tenantContext,
  requirePermission("members:invite"),
  revokeInvitation,
);

companiesRouter.patch(
  "/:companyId/members/:memberId",
  validateRequest({
    params: memberIdParamsSchema,
    body: updateMemberRoleSchema,
  }),
  tenantContext,
  requirePermission("members:update"),
  updateMemberRole,
);

companiesRouter.delete(
  "/:companyId/members/:memberId",
  validateRequest({ params: memberIdParamsSchema }),
  tenantContext,
  requirePermission("members:remove"),
  removeMember,
);

companiesRouter.post(
  "/:companyId/transfer-ownership",
  validateRequest({
    params: companyIdParamsSchema,
    body: transferOwnershipSchema,
  }),
  tenantContext,
  requirePermission("ownership:transfer"),
  transferOwnership,
);

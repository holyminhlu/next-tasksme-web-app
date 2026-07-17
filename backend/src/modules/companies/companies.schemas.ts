import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";

export const companyIdParamsSchema = z.object({
  companyId: z.string().uuid(),
});

export const updateCompanySchema = z.object({
  name: z.string().trim().min(2).max(120),
});

export const listMembersQuerySchema = paginationQuerySchema;

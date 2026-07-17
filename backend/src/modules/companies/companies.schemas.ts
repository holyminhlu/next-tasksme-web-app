import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";
import { INVITABLE_ROLE_KEYS } from "../auth/permissions.js";

export const companyIdParamsSchema = z.object({
  companyId: z.string().uuid(),
});

export const updateCompanySchema = z.object({
  name: z.string().trim().min(2).max(120),
});

export const listMembersQuerySchema = paginationQuerySchema;

export const inviteMemberSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  roleKey: z.enum(INVITABLE_ROLE_KEYS as unknown as [string, ...string[]]),
});

export const invitationTokenSchema = z.object({
  token: z.string().min(1),
});

export const invitationIdParamsSchema = z.object({
  companyId: z.string().uuid(),
  invitationId: z.string().uuid(),
});

export const memberIdParamsSchema = z.object({
  companyId: z.string().uuid(),
  memberId: z.string().uuid(),
});

export const updateMemberRoleSchema = z.object({
  roleKey: z.enum(INVITABLE_ROLE_KEYS as unknown as [string, ...string[]]),
});

export const transferOwnershipSchema = z.object({
  memberId: z.string().uuid(),
});

export const acceptInvitationSchema = z
  .object({
    token: z.string().min(1),
    fullName: z.string().trim().min(2).max(120).optional(),
    password: z
      .string()
      .min(8)
      .max(128)
      .regex(/[A-Za-z]/, "Password must include a letter")
      .regex(/[0-9]/, "Password must include a number")
      .optional(),
    confirmPassword: z.string().optional(),
  })
  .refine(
    (data) =>
      !data.password ||
      !data.confirmPassword ||
      data.password === data.confirmPassword,
    {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    },
  )
  .transform(({ confirmPassword: _confirmPassword, ...data }) => data);

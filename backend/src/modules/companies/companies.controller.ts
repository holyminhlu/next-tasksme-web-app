import type { NextFunction, Request, Response } from "express";
import type { PaginationQuery } from "../../lib/pagination.js";
import { sendSuccess } from "../../lib/response.js";
import { companiesService } from "./companies.service.js";

function getCompanyId(req: Request): string {
  const value = req.params.companyId;
  return Array.isArray(value) ? value[0]! : value!;
}

export async function getCompany(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const company = await companiesService.getCompany(getCompanyId(req));
    sendSuccess(res, company);
  } catch (error) {
    next(error);
  }
}

export async function updateCompany(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const company = await companiesService.updateCompany(
      getCompanyId(req),
      req.body.name as string,
    );
    sendSuccess(res, company);
  } catch (error) {
    next(error);
  }
}

export async function listMembers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await companiesService.listMembers(
      getCompanyId(req),
      req.query as unknown as PaginationQuery,
    );

    sendSuccess(res, result.members, {
      meta: {
        pagination: result.pagination,
      },
    });
  } catch (error) {
    next(error);
  }
}

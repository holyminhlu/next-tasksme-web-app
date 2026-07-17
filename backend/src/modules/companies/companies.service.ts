import { prisma } from "../../config/database.js";
import {
  buildPaginationMeta,
  getPagination,
  type PaginationQuery,
} from "../../lib/pagination.js";
import { NotFoundError } from "../../lib/errors.js";

export class CompaniesService {
  async getCompany(companyId: string) {
    const company = await prisma.company.findFirst({
      where: {
        id: companyId,
        deletedAt: null,
      },
    });

    if (!company) {
      throw new NotFoundError("Company not found");
    }

    return company;
  }

  async updateCompany(companyId: string, name: string) {
    return prisma.company.update({
      where: { id: companyId },
      data: { name },
    });
  }

  async listMembers(companyId: string, query: PaginationQuery) {
    const pagination = getPagination(query);

    const where = {
      companyId,
      deletedAt: null,
      ...(pagination.search
        ? {
            OR: [
              {
                user: {
                  fullName: {
                    contains: pagination.search,
                    mode: "insensitive" as const,
                  },
                },
              },
              {
                user: {
                  email: {
                    contains: pagination.search,
                    mode: "insensitive" as const,
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [total, members] = await Promise.all([
      prisma.companyMember.count({ where }),
      prisma.companyMember.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: {
          createdAt: pagination.sortOrder,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              status: true,
            },
          },
          role: {
            select: {
              id: true,
              key: true,
              name: true,
            },
          },
        },
      }),
    ]);

    return {
      members: members.map((member) => ({
        id: member.id,
        status: member.status,
        user: member.user,
        role: member.role,
        createdAt: member.createdAt,
      })),
      pagination: buildPaginationMeta(pagination.page, pagination.pageSize, total),
    };
  }
}

export const companiesService = new CompaniesService();

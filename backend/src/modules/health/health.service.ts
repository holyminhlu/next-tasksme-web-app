import { prisma } from "../../config/database";
import type { HealthStatus } from "./health.types";

export class HealthService {
  async getStatus(): Promise<HealthStatus> {
    try {
      await prisma.$queryRaw`SELECT 1`;

      return {
        status: "ok",
        service: "taskmng-backend",
        timestamp: new Date().toISOString(),
        database: {
          connected: true,
          message: "Connected to PostgreSQL database taskmng",
        },
      };
    } catch (error) {
      return {
        status: "degraded",
        service: "taskmng-backend",
        timestamp: new Date().toISOString(),
        database: {
          connected: false,
          message:
            error instanceof Error ? error.message : "Unknown database error",
        },
      };
    }
  }
}

export const healthService = new HealthService();

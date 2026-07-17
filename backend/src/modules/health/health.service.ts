import { prisma } from "../../config/database.js";
import { getEnv } from "../../config/env.js";
import { logger } from "../../config/logger.js";

export class HealthService {
  getLiveness() {
    return {
      status: "ok" as const,
      service: getEnv().APP_NAME,
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness() {
    const started = Date.now();

    try {
      await prisma.$queryRaw`SELECT 1`;

      return {
        status: "ok" as const,
        service: getEnv().APP_NAME,
        timestamp: new Date().toISOString(),
        checks: {
          database: {
            status: "up" as const,
            latencyMs: Date.now() - started,
          },
        },
      };
    } catch (error) {
      logger.error({ err: error }, "Readiness database check failed");

      return {
        status: "degraded" as const,
        service: getEnv().APP_NAME,
        timestamp: new Date().toISOString(),
        checks: {
          database: {
            status: "down" as const,
            latencyMs: Date.now() - started,
          },
        },
      };
    }
  }
}

export const healthService = new HealthService();

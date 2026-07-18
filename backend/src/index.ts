import http from "node:http";
import { createApp } from "./app.js";
import { disconnectPrisma } from "./config/database.js";
import { loadEnv } from "./config/env.js";
import { logger } from "./config/logger.js";
import { attachSocketServer } from "./realtime/socket-hub.js";

const env = loadEnv();
const app = createApp();
const server = http.createServer(app);
attachSocketServer(server);

server.listen(env.PORT, () => {
  logger.info(`Backend listening on http://localhost:${env.PORT}`);
});

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info({ signal }, "Shutting down gracefully");

  server.close(async (error) => {
    if (error) {
      logger.error({ err: error }, "Error while closing HTTP server");
      process.exit(1);
      return;
    }

    try {
      await disconnectPrisma();
      logger.info("Database connections closed");
      process.exit(0);
    } catch (disconnectError) {
      logger.error({ err: disconnectError }, "Error while disconnecting Prisma");
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

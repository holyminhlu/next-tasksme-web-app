import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { IncomingMessage } from "node:http";
import { getEnv } from "./config/env.js";
import { logger } from "./config/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { v1Router } from "./modules/index.js";
import { setupOpenApi } from "./openapi/setup.js";

export function createApp() {
  const env = getEnv();
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(requestIdMiddleware);
  app.use(
    pinoHttp({
      logger,
      customProps: (req: IncomingMessage & { requestId?: string }) => ({
        requestId: req.requestId,
      }),
      serializers: {
        req(request: IncomingMessage & { id?: string }) {
          return {
            id: request.id,
            method: request.method,
            url: request.url,
          };
        },
      },
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.CORS_ORIGINS.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("Origin not allowed by CORS"));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: env.BODY_SIZE_LIMIT }));
  app.use(cookieParser());
  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      skip: () => env.isTest,
    }),
  );

  app.get("/", (_req, res) => {
    res.json({
      success: true,
      data: {
        name: env.APP_NAME,
        version: "v1",
        docs: env.enableSwagger ? "/api/docs" : null,
      },
    });
  });

  setupOpenApi(app);
  app.use("/api/v1", v1Router);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

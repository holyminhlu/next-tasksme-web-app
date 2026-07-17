import type { Express } from "express";
import swaggerUi from "swagger-ui-express";
import { getEnv } from "../config/env.js";
import { buildOpenApiDocument } from "./document.js";

export function setupOpenApi(app: Express): void {
  const env = getEnv();
  if (!env.enableSwagger) {
    return;
  }

  const document = buildOpenApiDocument();

  app.get("/api/openapi.json", (_req, res) => {
    res.json(document);
  });

  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(document));
}

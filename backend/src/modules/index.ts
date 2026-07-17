import { Router } from "express";
import { healthRouter } from "./health/health.routes";

export const modulesRouter = Router();

modulesRouter.use("/health", healthRouter);

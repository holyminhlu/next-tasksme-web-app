import { Router } from "express";
import { authRouter } from "./auth/auth.routes.js";
import { companiesRouter } from "./companies/companies.routes.js";
import { healthRouter } from "./health/health.routes.js";

export const v1Router = Router();

v1Router.use("/health", healthRouter);
v1Router.use("/auth", authRouter);
v1Router.use("/companies", companiesRouter);

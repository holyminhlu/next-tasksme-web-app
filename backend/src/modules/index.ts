import { Router } from "express";
import { authRouter, meRouter } from "./auth/auth.routes.js";
import {
  invitationsRouter,
  workspacesRouter,
} from "./workspaces/workspaces.routes.js";
import { healthRouter } from "./health/health.routes.js";

export const v1Router = Router();

v1Router.use("/health", healthRouter);
v1Router.use("/auth", authRouter);
v1Router.use("/me", meRouter);
v1Router.use("/invitations", invitationsRouter);
v1Router.use("/workspaces", workspacesRouter);

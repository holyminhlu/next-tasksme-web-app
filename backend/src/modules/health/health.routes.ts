import { Router } from "express";
import { live, ready } from "./health.controller.js";

export const healthRouter = Router();

healthRouter.get("/live", live);
healthRouter.get("/ready", ready);

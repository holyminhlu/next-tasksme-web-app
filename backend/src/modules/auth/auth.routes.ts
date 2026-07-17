import { Router } from "express";
import rateLimit from "express-rate-limit";
import { getEnv } from "../../config/env.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validateRequest } from "../../middleware/validate.js";
import { login, logout, me, refresh, register } from "./auth.controller.js";
import { loginSchema, registerSchema } from "./auth.schemas.js";

const env = getEnv();

const authRateLimit = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many authentication attempts",
    },
  },
});

export const authRouter = Router();

authRouter.post(
  "/register",
  authRateLimit,
  validateRequest({ body: registerSchema }),
  register,
);

authRouter.post("/login", authRateLimit, validateRequest({ body: loginSchema }), login);

authRouter.post("/refresh", authRateLimit, refresh);
authRouter.post("/logout", logout);
authRouter.get("/me", authenticate, me);

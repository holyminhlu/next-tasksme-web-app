import { Router } from "express";
import rateLimit from "express-rate-limit";
import { getEnv } from "../../config/env.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireOrigin } from "../../middleware/requireOrigin.js";
import { validateRequest } from "../../middleware/validate.js";
import {
  changePassword,
  forgotPassword,
  listWorkspaces,
  listSessions,
  login,
  logout,
  logoutAll,
  me,
  refresh,
  register,
  resendVerification,
  resetPassword,
  revokeSession,
  selectWorkspace,
  verifyEmail,
} from "./auth.controller.js";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  selectWorkspaceSchema,
  sessionIdParamsSchema,
  verifyEmailSchema,
} from "./auth.schemas.js";

const env = getEnv();

const authRateLimit = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.isTest,
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

authRouter.post(
  "/login",
  authRateLimit,
  validateRequest({ body: loginSchema }),
  login,
);

authRouter.post("/refresh", requireOrigin, authRateLimit, refresh);
authRouter.post("/logout", requireOrigin, logout);
authRouter.post("/logout-all", authenticate, logoutAll);

authRouter.post(
  "/verify-email",
  authRateLimit,
  validateRequest({ body: verifyEmailSchema }),
  verifyEmail,
);

authRouter.post(
  "/resend-verification",
  authRateLimit,
  validateRequest({ body: resendVerificationSchema }),
  resendVerification,
);

authRouter.post(
  "/forgot-password",
  authRateLimit,
  validateRequest({ body: forgotPasswordSchema }),
  forgotPassword,
);

authRouter.post(
  "/reset-password",
  authRateLimit,
  validateRequest({ body: resetPasswordSchema }),
  resetPassword,
);

authRouter.post(
  "/change-password",
  authenticate,
  validateRequest({ body: changePasswordSchema }),
  changePassword,
);

authRouter.get("/me", authenticate, me);
authRouter.get("/sessions", authenticate, listSessions);
authRouter.delete(
  "/sessions/:sessionId",
  authenticate,
  validateRequest({ params: sessionIdParamsSchema }),
  revokeSession,
);

authRouter.post(
  "/select-workspace",
  authenticate,
  validateRequest({ body: selectWorkspaceSchema }),
  selectWorkspace,
);

export const meRouter = Router();
meRouter.use(authenticate);
meRouter.get("/workspaces", listWorkspaces);

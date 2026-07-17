import type { CookieOptions, NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/response.js";
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResendVerificationInput,
  ResetPasswordInput,
  SelectCompanyInput,
  VerifyEmailInput,
} from "./auth.schemas.js";
import { getRefreshCookieOptions } from "./auth.helpers.js";
import { REFRESH_COOKIE_NAME, authService } from "./auth.service.js";

function setRefreshCookie(
  res: Response,
  refreshToken: string,
  rememberMe: boolean,
) {
  res.cookie(
    REFRESH_COOKIE_NAME,
    refreshToken,
    getRefreshCookieOptions(rememberMe) as CookieOptions,
  );
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    ...getRefreshCookieOptions(false),
    maxAge: 0,
  } as CookieOptions);
}

export async function register(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await authService.register(req.body as RegisterInput, req);
    sendSuccess(res, result, { statusCode: 201 });
  } catch (error) {
    next(error);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await authService.login(req.body as LoginInput, req);
    setRefreshCookie(res, result.refreshToken, result.rememberMe);
    sendSuccess(res, {
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
}

export async function refresh(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await authService.refresh(req);
    setRefreshCookie(res, result.refreshToken, result.rememberMe);
    sendSuccess(res, {
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await authService.logout(req);
    clearRefreshCookie(res);
    sendSuccess(res, { loggedOut: true });
  } catch (error) {
    next(error);
  }
}

export async function logoutAll(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const result = await authService.logoutAll(req.user.id, req);
    clearRefreshCookie(res);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function verifyEmail(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await authService.verifyEmail(
      req.body as VerifyEmailInput,
      req,
    );
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function resendVerification(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await authService.resendVerification(
      req.body as ResendVerificationInput,
      req,
    );
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await authService.forgotPassword(
      req.body as ForgotPasswordInput,
      req,
    );
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await authService.resetPassword(
      req.body as ResetPasswordInput,
      req,
    );
    clearRefreshCookie(res);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function changePassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const result = await authService.changePassword(
      req.user.id,
      req.body as ChangePasswordInput,
      req,
    );
    clearRefreshCookie(res);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function me(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const profile = await authService.me(req.user.id);
    sendSuccess(res, profile);
  } catch (error) {
    next(error);
  }
}

export async function listCompanies(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const companies = await authService.listCompanies(req.user.id);
    sendSuccess(res, companies);
  } catch (error) {
    next(error);
  }
}

export async function selectCompany(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const company = await authService.selectCompany(
      req.user.id,
      req.body as SelectCompanyInput,
      req,
    );
    sendSuccess(res, company);
  } catch (error) {
    next(error);
  }
}

export async function listSessions(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const sessions = await authService.listSessions(
      req.user.id,
      req.sessionId,
    );
    sendSuccess(res, sessions);
  } catch (error) {
    next(error);
  }
}

export async function revokeSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const result = await authService.revokeSession(
      req.user.id,
      String(req.params.sessionId),
      req,
    );
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

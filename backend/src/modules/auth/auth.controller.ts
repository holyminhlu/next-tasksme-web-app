import type { CookieOptions, NextFunction, Request, Response } from "express";
import { sendSuccess } from "../../lib/response.js";
import {
  authService,
  getRefreshCookieName,
  getRefreshCookieOptions,
} from "./auth.service.js";
import type { LoginInput, RegisterInput } from "./auth.schemas.js";

function setRefreshCookie(res: Response, refreshToken: string) {
  res.cookie(
    getRefreshCookieName(),
    refreshToken,
    getRefreshCookieOptions() as CookieOptions,
  );
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(getRefreshCookieName(), {
    ...getRefreshCookieOptions(),
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
    setRefreshCookie(res, result.refreshToken);

    sendSuccess(
      res,
      {
        accessToken: result.accessToken,
        user: result.user,
        company: result.company,
      },
      { statusCode: 201 },
    );
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
    setRefreshCookie(res, result.refreshToken);

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
    setRefreshCookie(res, result.refreshToken);

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

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new Error("Missing authenticated user");
    }

    const profile = await authService.me(req.user.id);
    sendSuccess(res, profile);
  } catch (error) {
    next(error);
  }
}

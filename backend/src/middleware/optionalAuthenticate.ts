import type { NextFunction, Request, Response } from "express";
import { authenticate } from "./authenticate.js";

export async function optionalAuthenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    next();
    return;
  }

  await authenticate(req, res, next);
}

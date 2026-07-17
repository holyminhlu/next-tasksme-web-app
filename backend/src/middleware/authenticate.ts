import type { NextFunction, Request, Response } from "express";
import { prisma } from "../config/database.js";
import { UnauthorizedError } from "../lib/errors.js";
import { verifyAccessToken } from "../lib/tokens.js";

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedError("Missing or invalid access token");
    }

    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      throw new UnauthorizedError("Missing or invalid access token");
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new UnauthorizedError("Invalid or expired access token");
    }

    const user = await prisma.user.findFirst({
      where: {
        id: payload.sub,
        deletedAt: null,
      },
    });

    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedError("User is not active");
    }

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      status: user.status,
    };

    next();
  } catch (error) {
    next(error);
  }
}

import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { getEnv } from "../config/env.js";

export type AccessTokenPayload = {
  sub: string;
  email: string;
  sid: string;
  authVersion: number;
  type: "access";
};

export function signAccessToken(
  payload: Omit<AccessTokenPayload, "type">,
): string {
  const env = getEnv();
  return jwt.sign(
    {
      ...payload,
      type: "access",
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    },
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const env = getEnv();
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;

  if (
    payload.type !== "access" ||
    !payload.sub ||
    !payload.email ||
    !payload.sid ||
    typeof payload.authVersion !== "number"
  ) {
    throw new Error("Invalid access token");
  }

  return payload;
}

export function generateOpaqueToken(): string {
  return crypto.randomBytes(48).toString("base64url");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createTokenFamilyId(): string {
  return crypto.randomUUID();
}

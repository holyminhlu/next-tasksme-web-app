import pino from "pino";
import { getEnv } from "./env.js";

const redactPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers['set-cookie']",
  "password",
  "passwordHash",
  "accessToken",
  "refreshToken",
  "token",
  "body.password",
  "body.accessToken",
  "body.refreshToken",
];

export function createLogger() {
  const env = getEnv();

  return pino({
    name: env.APP_NAME,
    level: env.isTest ? "silent" : env.LOG_LEVEL,
    redact: {
      paths: redactPaths,
      censor: "[REDACTED]",
    },
    transport:
      env.isDevelopment && !env.isTest
        ? {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "SYS:standard",
            },
          }
        : undefined,
  });
}

export const logger = createLogger();

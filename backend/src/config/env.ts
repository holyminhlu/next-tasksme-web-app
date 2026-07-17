import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

const booleanFromEnv = z.union([z.boolean(), z.string()]).transform((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
});

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "staging", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  APP_NAME: z.string().min(1).default("taskmng-backend"),
  APP_URL: z.string().url().default("http://localhost:4000"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  CORS_ORIGINS: z
    .string()
    .min(1)
    .default("http://localhost:3000")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  DATABASE_URL: z
    .string()
    .url()
    .refine((value) => value.startsWith("postgresql"), {
      message: "DATABASE_URL must be a PostgreSQL connection string",
    }),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().min(1).default("15m"),
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().int().positive().default(14),
  REFRESH_TOKEN_REMEMBER_DAYS: z.coerce.number().int().positive().default(30),
  REFRESH_TOKEN_ABSOLUTE_DAYS: z.coerce.number().int().positive().default(60),
  COOKIE_SECURE: booleanFromEnv.default(false),
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  COOKIE_DOMAIN: z.string().optional(),
  BODY_SIZE_LIMIT: z.string().min(1).default("100kb"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  MAX_FAILED_LOGIN_ATTEMPTS: z.coerce.number().int().positive().default(5),
  ACCOUNT_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
  EMAIL_VERIFICATION_TTL_HOURS: z.coerce.number().int().positive().default(24),
  PASSWORD_RESET_TTL_HOURS: z.coerce.number().int().positive().default(1),
  INVITATION_TTL_HOURS: z.coerce.number().int().positive().default(72),
  // false: register activates users immediately (use until custom domain email is ready)
  REQUIRE_EMAIL_VERIFICATION: booleanFromEnv.default(false),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().default("onboarding@resend.dev"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  ENABLE_SWAGGER: booleanFromEnv.optional(),
});

export type Env = z.infer<typeof envSchema> & {
  isProduction: boolean;
  isTest: boolean;
  isDevelopment: boolean;
  enableSwagger: boolean;
};

let cachedEnv: Env | null = null;

export function loadEnv(overrides?: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse({
    ...process.env,
    ...overrides,
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  const data = parsed.data;

  if (
    data.NODE_ENV === "production" &&
    data.REQUIRE_EMAIL_VERIFICATION &&
    !data.RESEND_API_KEY
  ) {
    throw new Error(
      "Invalid environment configuration: RESEND_API_KEY is required in production when REQUIRE_EMAIL_VERIFICATION=true",
    );
  }

  const env: Env = {
    ...data,
    isProduction: data.NODE_ENV === "production",
    isTest: data.NODE_ENV === "test",
    isDevelopment: data.NODE_ENV === "development",
    enableSwagger:
      data.ENABLE_SWAGGER ??
      (data.NODE_ENV === "development" || data.NODE_ENV === "test"),
  };

  cachedEnv = env;
  return env;
}

export function getEnv(): Env {
  if (!cachedEnv) {
    return loadEnv();
  }

  return cachedEnv;
}

export function resetEnvCache(): void {
  cachedEnv = null;
}

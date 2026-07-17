import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { ValidationError } from "../lib/errors.js";

type RequestSchemas = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
};

export function validateRequest(schemas: RequestSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }

      if (schemas.query) {
        const parsed = schemas.query.parse(req.query);
        Object.defineProperty(req, "query", {
          value: parsed,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }

      if (schemas.params) {
        const parsed = schemas.params.parse(req.params);
        Object.defineProperty(req, "params", {
          value: parsed,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }

      next();
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "issues" in error &&
        Array.isArray((error as { issues: unknown[] }).issues)
      ) {
        next(
          new ValidationError(
            "Validation failed",
            (error as { issues: unknown[] }).issues,
          ),
        );
        return;
      }

      next(error);
    }
  };
}

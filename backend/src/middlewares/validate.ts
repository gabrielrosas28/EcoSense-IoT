import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodType } from "zod";
import { HttpError } from "../utils/HttpError.ts";

interface Schemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

/**
 * Valida `body`/`params`/`query` com schemas Zod e substitui o valor original
 * pelo já convertido. Handler só recebe dado validado.
 */
export const validate =
  (schemas: Schemas): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) => {
    for (const key of ["body", "params", "query"] as const) {
      const schema = schemas[key];
      if (!schema) continue;

      const result = schema.safeParse(req[key]);
      if (!result.success) {
        return next(
          HttpError.badRequest(
            `Dados inválidos em ${key}`,
            result.error.issues.map((i) => ({
              campo: i.path.join(".") || key,
              erro: i.message,
            })),
          ),
        );
      }

      // No Express 5 `req.query` é getter-only: guardamos o resultado à parte.
      if (key === "query") req.validatedQuery = result.data as Record<string, unknown>;
      else Object.assign(req, { [key]: result.data });
    }
    return next();
  };

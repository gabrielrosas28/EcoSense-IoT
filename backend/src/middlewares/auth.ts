import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "../config/env.ts";
import { HttpError } from "../utils/HttpError.ts";

/** Exige `Authorization: Bearer <token>` e popula `req.user`. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(HttpError.unauthorized("Token ausente"));
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = { id: String(payload.sub), email: String(payload["email"] ?? "") };
    return next();
  } catch {
    return next(HttpError.unauthorized("Token inválido ou expirado"));
  }
}

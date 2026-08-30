import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/HttpError.ts";

export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(HttpError.notFound(`Rota não encontrada: ${req.method} ${req.originalUrl}`));
}

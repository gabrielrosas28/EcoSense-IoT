import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.ts";
import { HttpError } from "../utils/HttpError.ts";

/** Códigos do Prisma que têm tradução HTTP óbvia. */
const PRISMA_STATUS: Record<string, [number, string]> = {
  P2002: [409, "Registro já existe"],
  P2003: [400, "Referência inválida para outro registro"],
  P2025: [404, "Registro não encontrado"],
};

const codeOf = (err: unknown): string | undefined =>
  typeof err === "object" && err !== null && "code" in err
    ? String((err as { code: unknown }).code)
    : undefined;

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // O Express só reconhece um error handler pela assinatura de 4 argumentos.
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  const prisma = PRISMA_STATUS[codeOf(err) ?? ""];
  if (prisma) {
    const [status, message] = prisma;
    res.status(status).json({ error: message, code: codeOf(err) });
    return;
  }

  console.error("[erro nao tratado]", err);
  res.status(500).json({
    error: "Erro interno do servidor",
    ...(env.isProd ? {} : { stack: err instanceof Error ? err.stack : undefined }),
  });
}

import type { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * Envolve um handler async para que rejeições virem `next(err)`.
 *
 * O Express 5 já encaminha promises rejeitadas, mas manter o wrapper deixa a
 * intenção explícita e protege quem escrever middleware fora do padrão.
 */
export const asyncHandler =
  (fn: AsyncHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

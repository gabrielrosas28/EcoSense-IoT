import { HttpError } from "../lib/httpError.js";
import { verifyToken } from "../lib/token.js";

/** Exige `Authorization: Bearer <token>` e preenche `req.user`. */
export function requireAuth(req, _res, next) {
  const [, token] = /^Bearer\s+(\S+)$/i.exec(req.get("authorization") ?? "") ?? [];
  if (!token) {
    return next(HttpError.unauthorized("Faça login para continuar"));
  }

  try {
    req.user = verifyToken(token);
    return next();
  } catch {
    return next(HttpError.unauthorized("Sessão inválida ou expirada"));
  }
}

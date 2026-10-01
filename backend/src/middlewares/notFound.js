import { HttpError } from "../lib/httpError.js";

export function notFound(req, _res, next) {
  next(HttpError.notFound(`Rota não encontrada: ${req.method} ${req.originalUrl}`));
}

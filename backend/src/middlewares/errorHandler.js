import { HttpError } from "../lib/httpError.js";

/** Erros do Postgres causados pela requisição, não pelo servidor. */
const DATABASE_ERRORS = {
  "23505": [409, "Registro duplicado"],
  "23503": [400, "Referência a um registro que não existe"],
  "23514": [400, "Valor fora do permitido"],
  "22P02": [400, "Valor em formato inválido"],
};

/** Erros do leitor de JSON do Express (`express.json()`). */
const BODY_ERRORS = {
  "entity.parse.failed": "O corpo da requisição não é um JSON válido",
  "entity.too.large": "O corpo da requisição é grande demais",
};

/**
 * Último middleware: toda resposta de erro da API sai daqui, sempre como
 * `{ error, details? }`. Erro inesperado vira 500 sem vazar detalhe interno.
 *
 * O Express reconhece um error handler pelos 4 parâmetros: não remova `_next`.
 */
export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, ...(err.details && { details: err.details }) });
    return;
  }

  const clientStatus = err.status ?? err.statusCode;
  if (clientStatus >= 400 && clientStatus < 500) {
    res.status(clientStatus).json({ error: BODY_ERRORS[err.type] ?? err.message });
    return;
  }

  const database = DATABASE_ERRORS[err.code];
  if (database) {
    const [status, message] = database;
    res.status(status).json({ error: message });
    return;
  }

  console.error(`[erro] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ error: "Erro interno do servidor" });
}

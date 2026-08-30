/** Erro com status HTTP. O errorHandler sabe traduzir isso numa resposta JSON. */
export class HttpError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }

  static badRequest(message = "Requisição inválida", details?: unknown): HttpError {
    return new HttpError(400, message, details);
  }

  static unauthorized(message = "Não autenticado"): HttpError {
    return new HttpError(401, message);
  }

  static forbidden(message = "Sem permissão"): HttpError {
    return new HttpError(403, message);
  }

  static notFound(message = "Recurso não encontrado"): HttpError {
    return new HttpError(404, message);
  }

  static conflict(message = "Conflito de estado"): HttpError {
    return new HttpError(409, message);
  }
}

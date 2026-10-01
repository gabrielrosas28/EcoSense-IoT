/**
 * Erro com status HTTP. Lance de qualquer camada; o `errorHandler` responde
 * `{ error, details? }`. Não faça try/catch em controller só para responder erro.
 */
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }

  static badRequest(message = "Requisição inválida", details) {
    return new HttpError(400, message, details);
  }

  static unauthorized(message = "Não autenticado") {
    return new HttpError(401, message);
  }

  static notFound(message = "Recurso não encontrado") {
    return new HttpError(404, message);
  }

  static conflict(message = "Conflito com o estado atual") {
    return new HttpError(409, message);
  }
}

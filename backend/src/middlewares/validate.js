import { HttpError } from "../lib/httpError.js";
import { toDetails } from "../lib/zod.js";

const MESSAGES = {
  params: "Parâmetro inválido na URL",
  query: "Parâmetro de consulta inválido",
  body: "Dados inválidos",
};

/**
 * Valida `params`, `query` e `body` com schemas Zod. O resultado, já convertido
 * e sem campos desconhecidos, fica em `req.validated`: controllers leem de lá,
 * nunca de `req.body` cru.
 */
export function validate(schemas) {
  return (req, _res, next) => {
    req.validated ??= {};
    for (const part of ["params", "query", "body"]) {
      const schema = schemas[part];
      if (!schema) continue;

      const result = schema.safeParse(req[part] ?? {});
      if (!result.success) {
        return next(HttpError.badRequest(MESSAGES[part], toDetails(result.error)));
      }
      req.validated[part] = result.data;
    }
    return next();
  };
}

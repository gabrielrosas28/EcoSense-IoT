import { describe, expect, it } from "vitest";
import { HttpError } from "../../src/utils/HttpError.ts";

describe("HttpError", () => {
  it("guarda status, mensagem e detalhes", () => {
    const err = HttpError.badRequest("Faltou campo", [{ campo: "email" }]);
    expect(err.status).toBe(400);
    expect(err.message).toBe("Faltou campo");
    expect(err.details).toEqual([{ campo: "email" }]);
  });

  it("é um Error de verdade (dá pra usar `instanceof` no errorHandler)", () => {
    expect(HttpError.notFound()).toBeInstanceOf(Error);
    expect(HttpError.notFound()).toBeInstanceOf(HttpError);
  });

  it.each([
    ["badRequest", HttpError.badRequest(), 400],
    ["unauthorized", HttpError.unauthorized(), 401],
    ["forbidden", HttpError.forbidden(), 403],
    ["notFound", HttpError.notFound(), 404],
    ["conflict", HttpError.conflict(), 409],
  ])("%s usa status %i", (_nome, err, status) => {
    expect(err.status).toBe(status);
  });
});

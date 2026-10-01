import { z } from "zod";

// Mensagens de validação em português em toda a API. Todo módulo importa o
// `z` daqui, nunca direto de "zod", para não perder essa configuração.
z.config(z.locales.ptBR());

/** Converte os problemas do Zod no formato de erro da API: `[{ campo, erro }]`. */
export function toDetails(error) {
  return error.issues.flatMap((issue) => {
    // Chave a mais num objeto estrito: aponta para a própria chave, não para o objeto.
    if (issue.code === "unrecognized_keys") {
      return issue.keys.map((key) => ({ campo: [...issue.path, key].join("."), erro: "campo não permitido" }));
    }
    return [{ campo: issue.path.join(".") || "(corpo)", erro: issue.message }];
  });
}

export { z };

import { z } from "zod";

z.config(z.locales.ptBR());

export function toDetails(error) {
  return error.issues.flatMap((issue) => {
    if (issue.code === "unrecognized_keys") {
      return issue.keys.map((key) => ({ campo: [...issue.path, key].join("."), erro: "campo não permitido" }));
    }
    return [{ campo: issue.path.join(".") || "(corpo)", erro: issue.message }];
  });
}

export { z };

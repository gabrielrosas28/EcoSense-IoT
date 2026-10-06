import { z } from "../lib/zod.js";

const email = z.email({ error: "Informe um e-mail válido" }).max(254);

// Mesmo mínimo que as telas de login e cadastro validam (frontend: pages/Login.jsx).
const password = z.string({ error: "Informe a senha" }).min(6, "A senha tem pelo menos 6 caracteres").max(200);

export const loginBody = z.object({ email, password });

export const registerBody = z.object({
  name: z
    .string({ error: "Informe o nome" })
    .trim()
    .min(2, "O nome tem pelo menos 2 caracteres")
    .max(100, "O nome tem no máximo 100 caracteres"),
  email,
  password,
});

import { z } from "../lib/zod.js";

export const loginBody = z.object({
  email: z.email({ error: "Informe um e-mail válido" }).max(254),
  // Mesmo mínimo que a tela de login valida (frontend: pages/Login.jsx).
  password: z.string({ error: "Informe a senha" }).min(6, "A senha tem pelo menos 6 caracteres").max(200),
});

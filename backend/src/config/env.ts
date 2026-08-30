import "dotenv/config";
import { z } from "zod";

/**
 * Toda variável de ambiente passa por aqui. Se faltar algo obrigatório,
 * o processo morre no boot com uma mensagem clara — nunca em produção,
 * no meio de uma request.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL é obrigatória (veja .env.example)")
    .startsWith("postgres", "DATABASE_URL deve apontar para um Postgres"),

  // Lista separada por vírgula. "*" libera geral (só use em dev).
  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  JWT_SECRET: z.string().min(16, "JWT_SECRET precisa ter ao menos 16 caracteres"),
  JWT_EXPIRES_IN: z.string().default("7d"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const detalhes = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  console.error(`\n[env] Configuração inválida:\n${detalhes}\n`);
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProd: raw.NODE_ENV === "production",
  isDev: raw.NODE_ENV === "development",
  corsOrigins:
    raw.CORS_ORIGIN === "*"
      ? ("*" as const)
      : raw.CORS_ORIGIN.split(",")
          .map((origin) => origin.trim())
          .filter(Boolean),
};

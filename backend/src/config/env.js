import { existsSync } from "node:fs";
import { z } from "../lib/zod.js";

/**
 * Configuração da aplicação, lida do ambiente e validada no boot.
 *
 * Variável faltando ou inválida derruba o processo aqui, com mensagem clara,
 * e nunca no meio de uma requisição. Variável nova: declare no schema, no
 * `.env.example` e na tabela do README.
 */

// O .env é opcional (em produção as variáveis vêm do ambiente) e nunca
// sobrescreve o que já está definido. Nos testes quem define é o Vitest.
const envFile = new URL("../../.env", import.meta.url);
if (process.env.NODE_ENV !== "test" && existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const required = "obrigatória (copie o .env.example para .env)";

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    CORS_ORIGIN: z.string().default("http://localhost:5173"),

    DATABASE_URL: z
      .string({ error: required })
      .regex(/^postgres(ql)?:\/\//, "deve começar com postgresql://"),
    DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

    JWT_SECRET: z.string({ error: required }).min(16, "precisa ter pelo menos 16 caracteres"),
    // Sem unidade o jsonwebtoken lê milissegundos ("120" = 120 ms): exigimos a unidade.
    JWT_EXPIRES_IN: z
      .string()
      .regex(/^\d+[smhd]$/, "use número + unidade (s, m, h ou d), ex.: 8h")
      .default("8h"),

    APP_TIMEZONE: z.string().refine(isTimeZone, "fuso horário inválido").default("America/Sao_Paulo"),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && env.JWT_SECRET.startsWith("troque")) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_SECRET"],
        message: "ainda é o valor de exemplo; gere um segredo de verdade para produção",
      });
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const problemas = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  console.error(`\n[config] Variáveis de ambiente inválidas:\n${problemas}\n`);
  process.exit(1);
}

const env = parsed.data;

export const config = Object.freeze({
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === "production",
  isTest: env.NODE_ENV === "test",
  port: env.PORT,
  corsOrigin: parseCorsOrigin(env.CORS_ORIGIN),
  database: Object.freeze({ url: env.DATABASE_URL, poolMax: env.DB_POOL_MAX }),
  jwt: Object.freeze({ secret: env.JWT_SECRET, expiresIn: env.JWT_EXPIRES_IN }),
  timezone: env.APP_TIMEZONE,
});

/** "*" libera qualquer origem; senão, lista separada por vírgula. */
function parseCorsOrigin(value) {
  if (value.trim() === "*") return "*";
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isTimeZone(value) {
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

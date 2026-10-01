import { afterAll, beforeEach, inject } from "vitest";

// src/config/env.js valida o ambiente no momento do import, então as variáveis
// precisam existir antes de qualquer módulo da aplicação ser carregado. Por
// isso os imports abaixo são dinâmicos.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = inject("databaseUrl");
process.env.JWT_SECRET = "segredo-usado-somente-nos-testes";
process.env.JWT_EXPIRES_IN = "1h";
process.env.CORS_ORIGIN = "http://localhost:5173";
process.env.APP_TIMEZONE = "America/Sao_Paulo";

const { closePool, pool } = await import("../../src/database/pool.js");
const { seed } = await import("../../src/database/seed.js");

// Cada teste começa do estado do seed, o mesmo que o frontend mostra no mock.
beforeEach(async () => {
  await pool.query("TRUNCATE events, routines, devices, users RESTART IDENTITY CASCADE");
  await seed(pool, { log: () => {} });
});

afterAll(closePool);

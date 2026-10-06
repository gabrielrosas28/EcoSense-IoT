import { afterAll, beforeEach, inject } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = inject("databaseUrl");
process.env.JWT_SECRET = "segredo-usado-somente-nos-testes";
process.env.JWT_EXPIRES_IN = "1h";
process.env.CORS_ORIGIN = "http://localhost:5173";
process.env.APP_TIMEZONE = "America/Sao_Paulo";
process.env.MQTT_URL = "";

const { closePool, pool } = await import("../../src/database/pool.js");
const { seed } = await import("../../src/database/seed.js");

beforeEach(async () => {
  await pool.query("TRUNCATE readings, events, routines, devices, users RESTART IDENTITY CASCADE");
  await seed(pool, { log: () => {} });
});

afterAll(closePool);

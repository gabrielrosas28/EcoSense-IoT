import { createApp } from "./app.js";
import { config } from "./config/env.js";
import { pendingMigrations } from "./database/migrator.js";
import { closePool, pool, waitForDatabase } from "./database/pool.js";

// Bootstrap: banco → HTTP → desligamento limpo.

try {
  await waitForDatabase();
} catch (err) {
  console.error(`[db] sem conexão com o PostgreSQL: ${err.message}`);
  console.error("     Confira o DATABASE_URL no .env e se o banco está de pé (docker compose up -d).");
  process.exit(1);
}

const pending = await pendingMigrations(pool);
if (pending.length > 0) {
  console.warn(`[db] migrations pendentes: ${pending.join(", ")}. Rode: npm run db:migrate`);
}

const server = createApp().listen(config.port, (err) => {
  if (err) {
    const motivo = err.code === "EADDRINUSE" ? `a porta ${config.port} já está em uso` : err.message;
    console.error(`[api] não foi possível subir: ${motivo}`);
    process.exit(1);
  }
  console.info(`[api] pronta em http://localhost:${config.port}/api (${config.env})`);
});

let closing = false;

async function shutdown(signal) {
  if (closing) return;
  closing = true;
  console.info(`[api] ${signal} recebido, encerrando...`);

  // Se alguma conexão segurar o encerramento, desiste depois de 10 s.
  setTimeout(() => process.exit(1), 10_000).unref();
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

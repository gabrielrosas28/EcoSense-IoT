import { createApp } from "./app.ts";
import { env } from "./config/env.ts";
import { connectDatabase, disconnectDatabase } from "./lib/prisma.ts";

const app = createApp();

try {
  await connectDatabase();
  console.info("[db] conectado ao Postgres");
} catch (err) {
  const motivo = err instanceof Error ? err.message : String(err);
  console.error("[db] não foi possível conectar ao Postgres:", motivo);
  console.error("     confira DATABASE_URL no .env e se o banco está de pé.");
  process.exit(1);
}

const server = app.listen(env.PORT, () => {
  console.info(`[api] http://localhost:${env.PORT}/api (${env.NODE_ENV})`);
});

/** Encerra conexões abertas antes de morrer — evita conexão pendurada no banco. */
for (const sinal of ["SIGINT", "SIGTERM"] as const) {
  process.on(sinal, () => {
    console.info(`\n[api] ${sinal} recebido, encerrando...`);
    server.close(() => {
      void disconnectDatabase().then(() => process.exit(0));
    });
  });
}

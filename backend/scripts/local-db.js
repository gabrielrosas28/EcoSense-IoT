// PostgreSQL embutido (PGlite) para desenvolver sem Docker: npm run db:local
//
// É o Postgres de verdade compilado para WebAssembly, rodando dentro do Node e
// atendendo na porta do DATABASE_URL. Os dados ficam em `.pglite/` (fora do
// git). Para produção, use um PostgreSQL normal.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const envFile = new URL("../.env", import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

const url = new URL(process.env.DATABASE_URL ?? "postgresql://localhost:5432");
const port = Number(url.port || 5432);
const dataDir = fileURLToPath(new URL("../.pglite", import.meta.url));

const db = await PGlite.create({ dataDir });
const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port, maxConnections: 20 });

try {
  await server.start();
} catch (err) {
  const motivo = err.code === "EADDRINUSE" ? `a porta ${port} já está em uso (outro Postgres rodando?)` : err.message;
  console.error(`[pglite] não foi possível subir: ${motivo}`);
  await db.close();
  process.exit(1);
}

console.info(`[pglite] PostgreSQL embutido em 127.0.0.1:${port}, dados em .pglite/`);
console.info("[pglite] Em outro terminal: npm run db:migrate && npm run db:seed && npm run dev");

async function shutdown() {
  await server.stop();
  await db.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

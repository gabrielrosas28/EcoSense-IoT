import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import pg from "pg";
import { migrate } from "../../src/database/migrator.js";

/**
 * Sobe um PostgreSQL de verdade para a suíte: o PGlite (Postgres compilado
 * para WebAssembly), em memória, numa porta livre. As migrations rodam uma vez
 * aqui; antes de cada teste o setup.js só limpa os dados e refaz o seed.
 *
 * A API fala com ele pelo driver `pg`, o mesmo caminho que usa com o Postgres
 * do Docker. Não há banco falso nem mock de query: SQL errado quebra o teste.
 */
export default async function setup(project) {
  const db = await PGlite.create();
  const server = new PGLiteSocketServer({ db, port: 0, maxConnections: 10 });
  await server.start();
  const url = `postgresql://postgres:postgres@${server.getServerConn()}/postgres`;

  const pool = new pg.Pool({ connectionString: url });
  await migrate(pool, { log: () => {} });
  await pool.end();

  project.provide("databaseUrl", url);

  return async () => {
    await server.stop();
    await db.close();
  };
}

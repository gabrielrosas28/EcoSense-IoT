import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import pg from "pg";
import { migrate } from "../../src/database/migrator.js";

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

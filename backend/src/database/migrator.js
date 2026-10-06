import { readdir, readFile } from "node:fs/promises";

const MIGRATIONS_DIR = new URL("./migrations/", import.meta.url);

const LOCK_KEY = 20_261_001;

export async function migrate(pool, { log = console.info } = {}) {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);

    const pending = await pendingMigrations(client);
    for (const name of pending) {
      const sql = await readFile(new URL(name, MIGRATIONS_DIR), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`a migration ${name} falhou: ${err.message}`, { cause: err });
      }
      log(`[db] migration aplicada: ${name}`);
    }
    return pending;
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
    client.release();
  }
}

export async function pendingMigrations(db) {
  const { rows } = await db.query("SELECT to_regclass('schema_migrations') IS NOT NULL AS ready");
  const applied = rows[0].ready
    ? new Set((await db.query("SELECT name FROM schema_migrations")).rows.map((row) => row.name))
    : new Set();

  const files = await readdir(MIGRATIONS_DIR);
  return files
    .filter((file) => file.endsWith(".sql") && !applied.has(file))
    .sort();
}

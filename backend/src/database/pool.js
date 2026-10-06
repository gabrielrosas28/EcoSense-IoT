import pg from "pg";
import { config } from "../config/env.js";

export const pool = new pg.Pool({
  connectionString: config.database.url,
  max: config.database.poolMax,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
});

pool.on("error", (err) => {
  console.error("[db] conexão ociosa perdida:", err.message);
});

export async function transaction(work) {
  const client = await pool.connect();
  let broken = false;
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      broken = true;
    }
    throw err;
  } finally {
    client.release(broken);
  }
}

export async function pingDatabase() {
  await pool.query("SELECT 1");
}

export async function waitForDatabase({ attempts = 5, delayMs = 1_000 } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      await pingDatabase();
      return;
    } catch (err) {
      if (attempt >= attempts) throw err;
      console.warn(`[db] banco indisponível (tentativa ${attempt}/${attempts}): ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
}

let closed = false;

export async function closePool() {
  if (closed) return;
  closed = true;
  await pool.end();
}

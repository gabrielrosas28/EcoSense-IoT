import pg from "pg";
import { config } from "../config/env.js";

/**
 * Conexão com o PostgreSQL: um único pool para a aplicação inteira.
 *
 * Repositórios recebem `db` como último parâmetro (o pool, por padrão, ou o
 * client de uma transação) e nunca abrem conexão por conta própria.
 */
export const pool = new pg.Pool({
  connectionString: config.database.url,
  max: config.database.poolMax,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
});

// Conexão ociosa que cai (banco reiniciou, rede oscilou) emite "error" no
// pool. Sem este listener o processo inteiro morreria por causa dela.
pool.on("error", (err) => {
  console.error("[db] conexão ociosa perdida:", err.message);
});

/**
 * Executa `work(client)` numa transação: COMMIT se tudo der certo, ROLLBACK se
 * algo lançar. Dentro dela, use sempre o `client` recebido, porque query feita
 * pelo `pool` roda em outra conexão, FORA da transação.
 */
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
      broken = true; // conexão inutilizável: descarta em vez de devolver ao pool
    }
    throw err;
  } finally {
    client.release(broken);
  }
}

/** Responde se o banco está aceitando consultas (usado pelo /api/health). */
export async function pingDatabase() {
  await pool.query("SELECT 1");
}

/** Espera o banco aceitar conexões, o que é útil logo depois do `docker compose up`. */
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

/** Fecha todas as conexões. Seguro de chamar mais de uma vez. */
export async function closePool() {
  if (closed) return;
  closed = true;
  await pool.end();
}

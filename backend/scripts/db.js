// Tarefas de banco: npm run db:migrate | db:seed | db:reset
import { config } from "../src/config/env.js";
import { migrate } from "../src/database/migrator.js";
import { closePool, pool } from "../src/database/pool.js";
import { seed } from "../src/database/seed.js";

const tasks = {
  async migrate() {
    const applied = await migrate(pool);
    if (applied.length === 0) console.info("[db] nenhuma migration pendente");
  },

  seed: () => seed(pool),

  /** Apaga TUDO e recria do zero. Só para desenvolvimento. */
  async reset() {
    if (config.isProduction) {
      throw new Error("db:reset apaga o banco inteiro e está bloqueado com NODE_ENV=production");
    }
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    console.info("[db] banco apagado");
    await migrate(pool);
    await seed(pool);
  },
};

const name = process.argv[2];
const task = tasks[name];

if (!task) {
  console.error(`Uso: node scripts/db.js <${Object.keys(tasks).join("|")}>`);
  process.exitCode = 1;
} else {
  try {
    await task();
  } catch (err) {
    console.error(`[db] ${name} falhou: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

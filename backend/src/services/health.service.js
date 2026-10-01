import { pingDatabase } from "../database/pool.js";

/** Situação da API e do banco, para monitoramento e para o `docker compose`. */
export async function getHealth() {
  let database = "up";
  try {
    await pingDatabase();
  } catch {
    database = "down";
  }

  return {
    status: database === "up" ? "ok" : "degraded",
    database,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}

import { pingDatabase } from "../database/pool.js";
import { mqttStatus } from "../mqtt/index.js";

/**
 * Situação da API, do banco e do broker MQTT. Sem banco a API não funciona;
 * sem broker ela funciona, mas os comandos não chegam aos dispositivos.
 */
export async function getHealth() {
  let database = "up";
  try {
    await pingDatabase();
  } catch {
    database = "down";
  }
  const mqtt = mqttStatus();

  return {
    status: database === "up" && mqtt !== "down" ? "ok" : "degraded",
    database,
    mqtt,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}

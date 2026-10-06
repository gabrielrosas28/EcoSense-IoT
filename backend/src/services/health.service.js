import { pingDatabase } from "../database/pool.js";
import { mqttStatus } from "../mqtt/index.js";

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

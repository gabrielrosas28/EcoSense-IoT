import { loadConfig } from "./config.ts";
import { startConsole } from "./console.ts";
import { seededRng } from "./devices.ts";
import { Simulator } from "./simulator.ts";

/**
 * Simulador dos sensores EcoSense — faz o papel do ESP32 no broker MQTT.
 *
 *   npm start          (lê .env, se existir)
 */

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(`[simulador] ${(err as Error).message}`);
  process.exit(1);
}

const rng = config.seed === undefined ? Math.random : seededRng(config.seed);
const sim = new Simulator(config, rng);

console.log(
  `EcoSense simulador — broker ${config.mqttUrl} · dispositivos: ${config.devices.join(", ")} · ` +
    `velocidade ${config.speed}x`,
);
sim.start();

let encerrando = false;
async function shutdown() {
  if (encerrando) return;
  encerrando = true;
  console.log("\nEncerrando — publicando online=false…");
  const timeout = setTimeout(() => process.exit(0), 3000);
  await sim.stop().catch(() => {});
  clearTimeout(timeout);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
startConsole(sim, shutdown);

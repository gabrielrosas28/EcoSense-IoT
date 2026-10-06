import { DEVICE_SLUGS, type DeviceSlug, isDeviceSlug } from "./contract.ts";

export interface Config {
  mqttUrl: string;
  mqttUsername: string | undefined;
  mqttPassword: string | undefined;
  tickMs: number;
  speed: number;
  publishMs: number;
  devices: DeviceSlug[];
  seed: number | undefined;
  verbose: boolean;
}

function numero(name: string, fallback: number, min: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min) {
    throw new Error(`${name} inválido: "${raw}" (esperado número ≥ ${min})`);
  }
  return value;
}

function dispositivos(): DeviceSlug[] {
  const raw = process.env.SIM_DEVICES;
  if (!raw) return [...DEVICE_SLUGS];
  const lista = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const invalidos = lista.filter((s) => !isDeviceSlug(s));
  if (invalidos.length) {
    throw new Error(
      `SIM_DEVICES com dispositivo desconhecido: ${invalidos.join(", ")} ` +
        `(use: ${DEVICE_SLUGS.join(", ")})`,
    );
  }
  return lista as DeviceSlug[];
}

export function loadConfig(): Config {
  const seed = process.env.SIM_SEED;
  return {
    mqttUrl: process.env.MQTT_URL || "mqtt://localhost:1883",
    mqttUsername: process.env.MQTT_USERNAME || undefined,
    mqttPassword: process.env.MQTT_PASSWORD || undefined,
    tickMs: numero("SIM_TICK_MS", 1000, 50),
    speed: numero("SIM_SPEED", 1, 0.01),
    publishMs: numero("SIM_PUBLISH_MS", 5000, 100),
    devices: dispositivos(),
    seed: seed ? numero("SIM_SEED", 0, 0) : undefined,
    verbose: process.env.SIM_VERBOSE === "1" || process.env.SIM_VERBOSE === "true",
  };
}

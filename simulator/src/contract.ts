/**
 * Contrato MQTT — o mesmo do backend (`backend/src/services/deviceBus.ts`) e
 * do store do frontend (`frontend/src/store/useDevices.js`).
 *
 *   Comando (backend → device):  ecosense/<slug>/cmd     { action, ... }
 *   Status  (device → backend):  ecosense/<slug>/status  { on, mode, online, ...reading }
 *
 * Mexeu aqui? Alinhe com os dois lados — o simulador tem que ser
 * indistinguível do ESP32.
 */

export const DEVICE_SLUGS = ["luz", "projetor", "irrigacao", "umidificador"] as const;
export type DeviceSlug = (typeof DEVICE_SLUGS)[number];

export const TOPIC = {
  command: (slug: string) => `ecosense/${slug}/cmd`,
  status: (slug: string) => `ecosense/${slug}/status`,
};

export type Mode = "auto" | "manual";

/** Comando como o `api.sendCommand` do frontend envia e o backend repassa. */
export interface DeviceCommand {
  action: string;
  key?: string;
  value?: string | number | boolean;
  [extra: string]: unknown;
}

/** Payload de status publicado pelo dispositivo. */
export interface DeviceStatus {
  on: boolean;
  mode: Mode;
  online: boolean;
  [reading: string]: unknown;
}

export function isDeviceSlug(value: string): value is DeviceSlug {
  return (DEVICE_SLUGS as readonly string[]).includes(value);
}

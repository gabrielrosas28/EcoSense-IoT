import { config } from "../config/env.js";
import { createMqttBridge } from "./bridge.js";

/** A ponte da aplicação, ou `null` quando MQTT_URL está vazio. */
export const mqttBridge = config.mqtt.url ? createMqttBridge(config.mqtt) : null;

/** "up", "down" ou "disabled" (sem MQTT_URL): aparece no /api/health. */
export function mqttStatus() {
  return mqttBridge ? mqttBridge.status() : "disabled";
}

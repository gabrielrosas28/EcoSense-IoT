import { config } from "../config/env.js";
import { createMqttBridge } from "./bridge.js";

export const mqttBridge = config.mqtt.url ? createMqttBridge(config.mqtt) : null;

export function mqttStatus() {
  return mqttBridge ? mqttBridge.status() : "disabled";
}

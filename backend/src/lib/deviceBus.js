import { EventEmitter } from "node:events";

export const deviceBus = new EventEmitter();

export const commandTopic = (deviceId) => `ecosense/${deviceId}/cmd`;

export function publishCommand(deviceId, command) {
  const topic = commandTopic(deviceId);
  if (deviceBus.listenerCount("command") === 0) {
    console.info(`[bus] MQTT desativado (MQTT_URL vazio), comando não entregue: ${topic} ${JSON.stringify(command)}`);
  }
  deviceBus.emit("command", { deviceId, topic, command });
  return { topic };
}

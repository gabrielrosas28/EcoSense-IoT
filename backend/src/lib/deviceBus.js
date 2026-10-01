import { EventEmitter } from "node:events";

/**
 * Barramento interno de comandos para os dispositivos.
 *
 * Os services publicam aqui sem saber quem entrega. A ponte MQTT
 * (`src/mqtt/bridge.js`) assina o evento "command" e publica no broker, em
 * `ecosense/<id>/cmd`. Sem MQTT configurado, o comando só aparece no log.
 */
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

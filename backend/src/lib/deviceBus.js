import { EventEmitter } from "node:events";

/**
 * Ponto de encaixe com o hardware.
 *
 * Os services publicam comandos aqui sem saber quem os entrega. Por enquanto
 * ninguém entrega: o comando só aparece no log. A integração MQTT (próxima
 * etapa) vai assinar o evento "command" e publicar no tópico, e fará o caminho
 * inverso assinando `ecosense/+/status`. É o mesmo contrato do simulador
 * (`simulator/src/contract.ts`). Nenhum service precisa mudar.
 */
export const deviceBus = new EventEmitter();

export const commandTopic = (deviceId) => `ecosense/${deviceId}/cmd`;

export function publishCommand(deviceId, command) {
  const topic = commandTopic(deviceId);
  if (deviceBus.listenerCount("command") === 0) {
    console.info(`[bus] broker ainda não conectado, comando não entregue: ${topic} ${JSON.stringify(command)}`);
  }
  deviceBus.emit("command", { deviceId, topic, command });
  return { topic };
}

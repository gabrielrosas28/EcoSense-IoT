import type { DeviceCommand } from "../types/api.ts";

/**
 * Ponto de encaixe do MQTT (fase 2).
 *
 * Hoje o backend só registra o comando no banco e devolve OK. Quando o broker
 * entrar, é AQUI que se publica em `ecosense/<slug>/cmd` — nenhum controller
 * precisa mudar, porque todos passam por `publishCommand`.
 *
 * O caminho inverso (status vindo do device) vai chamar
 * `devices.applyIncomingStatus`, o mesmo método usado pelo WebSocket.
 */

export const TOPIC = {
  command: (slug: string) => `ecosense/${slug}/cmd`,
  status: (slug: string) => `ecosense/${slug}/status`,
};

export interface PublishResult {
  topic: string;
  delivered: boolean;
}

export async function publishCommand(
  slug: string,
  payload: DeviceCommand,
): Promise<PublishResult> {
  const topic = TOPIC.command(slug);
  // TODO(fase 2): mqttClient.publish(topic, JSON.stringify(payload), { qos: 1 })
  console.info(`[bus] -> ${topic}`, JSON.stringify(payload));
  return { topic, delivered: false };
}

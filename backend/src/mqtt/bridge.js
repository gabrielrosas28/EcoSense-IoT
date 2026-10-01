import { randomBytes } from "node:crypto";
import mqtt from "mqtt";
import { deviceBus } from "../lib/deviceBus.js";
import * as deviceService from "../services/device.service.js";

export const STATUS_TOPIC = "ecosense/+/status";
const STATUS_TOPIC_PATTERN = /^ecosense\/([^/]+)\/status$/;
const RECONNECT_MS = 5_000;

/**
 * Ponte entre a API e o broker MQTT (Mosquitto):
 *
 *   painel → API → deviceBus "command" → publish   ecosense/<id>/cmd     (QoS 1)
 *   dispositivo → subscribe ecosense/+/status → applyStatus → PostgreSQL  (QoS 1)
 *
 * É o mesmo contrato do simulador (simulator/README.md). A API não depende do
 * broker para subir: sem conexão, o mqtt.js tenta de novo sozinho e guarda os
 * comandos até reconectar.
 */
export function createMqttBridge({ url, username, password, log = console }) {
  let client = null;
  // Status são gravados um por vez, na ordem em que chegam: dois heartbeats
  // seguidos do mesmo dispositivo não podem ser aplicados fora de ordem.
  let queue = Promise.resolve();

  function onCommand({ deviceId, topic, command }) {
    if (!client.connected) {
      log.warn(`[mqtt] broker fora do ar: o comando para ${deviceId} será enviado quando reconectar`);
    }
    // Comando não é retido: um dispositivo que reconecta não pode repetir ordem velha.
    client.publish(topic, JSON.stringify(command), { qos: 1 }, (err) => {
      if (err) log.error(`[mqtt] falha ao publicar em ${topic}: ${err.message}`);
    });
  }

  function onMessage(topic, raw) {
    const [, deviceId] = STATUS_TOPIC_PATTERN.exec(topic) ?? [];
    if (!deviceId) return;
    queue = queue
      .then(() => handleStatus(deviceId, raw.toString()))
      .catch((err) => log.error(`[mqtt] erro ao gravar status de ${deviceId}:`, err));
  }

  async function handleStatus(deviceId, text) {
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      log.warn(`[mqtt] status de ${deviceId} não é JSON, ignorado: ${text.slice(0, 100)}`);
      return;
    }
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
      log.warn(`[mqtt] status de ${deviceId} não é um objeto JSON, ignorado`);
      return;
    }

    const result = await deviceService.applyStatus(deviceId, payload);
    if (!result) {
      log.warn(`[mqtt] status de dispositivo desconhecido ignorado: ${deviceId}`);
    } else if (result.ignored.length > 0) {
      log.warn(`[mqtt] ${deviceId}: campos ignorados no status: ${result.ignored.join(", ")}`);
    }
  }

  return {
    start() {
      client = mqtt.connect(url, {
        clientId: `ecosense-api-${randomBytes(3).toString("hex")}`,
        username,
        password,
        reconnectPeriod: RECONNECT_MS,
      });

      // Sem broker, o mqtt.js tenta de novo a cada 5 s: avisa uma vez só por queda.
      let warned = false;
      client.on("connect", () => {
        warned = false;
        log.info(`[mqtt] conectado em ${url}`);
        // Status é retido: ao assinar, chega na hora o último estado de cada dispositivo.
        client.subscribe(STATUS_TOPIC, { qos: 1 }, (err) => {
          if (err) log.error(`[mqtt] falha ao assinar ${STATUS_TOPIC}: ${err.message}`);
        });
      });
      client.on("offline", () => {
        if (warned) return;
        warned = true;
        log.warn(`[mqtt] sem conexão com o broker em ${url}; tentando de novo a cada ${RECONNECT_MS / 1000} s`);
      });
      client.on("error", (err) => {
        if (!warned) log.warn(`[mqtt] ${err.message}`);
      });
      client.on("message", onMessage);

      deviceBus.on("command", onCommand);
    },

    /** Para de receber, espera os status em andamento e fecha a conexão. */
    async stop() {
      deviceBus.off("command", onCommand);
      await client?.endAsync();
      await queue;
    },

    /** "up" quando conectado ao broker; "down" enquanto tenta reconectar. */
    status() {
      return client?.connected ? "up" : "down";
    },
  };
}

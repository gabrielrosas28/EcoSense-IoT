import { randomBytes } from "node:crypto";
import mqtt from "mqtt";
import { deviceBus } from "../lib/deviceBus.js";
import * as automation from "../services/automation.service.js";
import * as deviceService from "../services/device.service.js";

export const STATUS_TOPIC = "ecosense/+/status";
const STATUS_TOPIC_PATTERN = /^ecosense\/([^/]+)\/status$/;
const RECONNECT_MS = 5_000;

export function createMqttBridge({ url, username, password, log = console }) {
  let client = null;
  let queue = Promise.resolve();
  let stopping = false;

  function onCommand({ deviceId, topic, command }) {
    if (!client.connected) {
      log.warn(`[mqtt] broker fora do ar: o comando para ${deviceId} será enviado quando reconectar`);
    }
    client.publish(topic, JSON.stringify(command), { qos: 1 }, (err) => {
      if (err) log.error(`[mqtt] falha ao publicar em ${topic}: ${err.message}`);
    });
  }

  function onMessage(topic, raw) {
    const [, deviceId] = STATUS_TOPIC_PATTERN.exec(topic) ?? [];
    if (!deviceId || stopping) return;
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
      return;
    }
    if (result.ignored.length > 0) {
      log.warn(`[mqtt] ${deviceId}: campos ignorados no status: ${result.ignored.join(", ")}`);
    }
    automation.logResults(log, await automation.afterStatus(result));
  }

  return {
    start() {
      stopping = false;
      client = mqtt.connect(url, {
        clientId: `ecosense-api-${randomBytes(3).toString("hex")}`,
        username,
        password,
        reconnectPeriod: RECONNECT_MS,
      });

      let warned = false;
      client.on("connect", () => {
        warned = false;
        log.info(`[mqtt] conectado em ${url}`);
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

    async stop() {
      stopping = true;
      await queue;
      deviceBus.off("command", onCommand);
      await client?.endAsync();
    },

    status() {
      return client?.connected ? "up" : "down";
    },
  };
}

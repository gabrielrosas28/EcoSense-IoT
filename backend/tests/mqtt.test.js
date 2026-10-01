import { createServer } from "node:net";
import { Aedes } from "aedes";
import mqtt from "mqtt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { createMqttBridge, STATUS_TOPIC } from "../src/mqtt/bridge.js";
import { authHeader } from "./support/auth.js";

/**
 * A ponte MQTT de ponta a ponta contra um broker em memória (aedes), sem
 * Docker. Um cliente MQTT faz o papel do dispositivo, como o simulador/ESP32:
 * assina `ecosense/+/cmd` e publica em `ecosense/<id>/status`.
 */

const app = createApp();
const auth = authHeader();
const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const ESPERA = { timeout: 3_000, interval: 25 };

let broker;
let server;
let url;
let bridge;
let dispositivo;
const comandos = [];

const device = async (id) => (await request(app).get(`/api/devices/${id}`).set("Authorization", auth)).body;
const events = async () => (await request(app).get("/api/events?limit=100").set("Authorization", auth)).body;
const status = (id, payload, opts = {}) =>
  dispositivo.publishAsync(`ecosense/${id}/status`, JSON.stringify(payload), { qos: 1, ...opts });

/** Sobe uma ponte nova e espera ela assinar os status (não só conectar). */
async function startBridge() {
  const assinou = new Promise((resolve) => {
    broker.on("subscribe", function aguardar(subscriptions) {
      if (subscriptions.some((s) => s.topic === STATUS_TOPIC)) {
        broker.off("subscribe", aguardar);
        resolve();
      }
    });
  });
  const nova = createMqttBridge({ url, log });
  nova.start();
  await assinou;
  return nova;
}

beforeAll(async () => {
  broker = await Aedes.createBroker();
  server = createServer(broker.handle);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `mqtt://127.0.0.1:${server.address().port}`;

  bridge = await startBridge();

  dispositivo = await mqtt.connectAsync(url, { clientId: "teste-dispositivo" });
  await dispositivo.subscribeAsync("ecosense/+/cmd", { qos: 1 });
  dispositivo.on("message", (topic, raw, packet) => {
    comandos.push({ topic, payload: JSON.parse(raw.toString()), qos: packet.qos });
  });
});

afterAll(async () => {
  await bridge.stop();
  await dispositivo.endAsync();
  await new Promise((resolve) => broker.close(resolve));
  await new Promise((resolve) => server.close(resolve));
});

describe("ponte MQTT", () => {
  it("fica conectada ao broker", () => {
    expect(bridge.status()).toBe("up");
  });

  it("publica o comando da API em ecosense/<id>/cmd, com QoS 1", async () => {
    comandos.length = 0;

    await request(app)
      .post("/api/devices/irrigacao/command")
      .set("Authorization", auth)
      .send({ action: "threshold", key: "threshold", value: 25 })
      .expect(202);

    await vi.waitFor(() => expect(comandos).toHaveLength(1), ESPERA);
    expect(comandos[0]).toMatchObject({
      topic: "ecosense/irrigacao/cmd",
      payload: { action: "threshold", key: "threshold", value: 25 },
      qos: 1,
    });
  });

  it("não retém comando: dispositivo que conecta depois não recebe ordem velha", async () => {
    await request(app)
      .post("/api/devices/luz/command")
      .set("Authorization", auth)
      .send({ action: "power", value: "off" })
      .expect(202);
    await vi.waitFor(() => expect(comandos.some((c) => c.topic === "ecosense/luz/cmd")).toBe(true), ESPERA);

    // Quem já está inscrito sempre recebe com retain=0 (regra do MQTT); só um
    // cliente novo mostra se o broker guardou a mensagem.
    const recemChegado = await mqtt.connectAsync(url, { clientId: "teste-esp32-reconectando" });
    const recebidos = [];
    recemChegado.on("message", (topic) => recebidos.push(topic));
    await recemChegado.subscribeAsync("ecosense/+/cmd", { qos: 1 });
    await new Promise((resolve) => setTimeout(resolve, 300));
    await recemChegado.endAsync();

    expect(recebidos).toEqual([]);
  });

  it("grava no banco o status que o dispositivo publica", async () => {
    await status("irrigacao", { on: true, mode: "auto", online: true, soil: 18, threshold: 30, maxPumpSec: 10 });

    await vi.waitFor(async () => {
      expect(await device("irrigacao")).toMatchObject({ on: true, reading: { soil: 18 } });
    }, ESPERA);
  });

  it("fecha o ciclo: comando → dispositivo obedece → status confirma, sem evento duplicado", async () => {
    // Dispositivo de mentira: obedece ao power e confirma publicando o status.
    const obedecer = (topic, raw) => {
      const comando = JSON.parse(raw.toString());
      if (topic === "ecosense/umidificador/cmd" && comando.action === "power") {
        void status("umidificador", { on: comando.value === "on", mode: "auto", online: true, air: 58, threshold: 80 });
      }
    };
    dispositivo.on("message", obedecer);
    try {
      await request(app)
        .post("/api/devices/umidificador/command")
        .set("Authorization", auth)
        .send({ action: "power", value: "off" })
        .expect(202);

      await vi.waitFor(async () => {
        expect((await device("umidificador")).lastSeenAt).not.toBeNull();
      }, ESPERA);
    } finally {
      dispositivo.off("message", obedecer);
    }

    expect((await device("umidificador")).on).toBe(false);
    const textos = (await events()).map((event) => event.text);
    expect(textos.filter((texto) => texto.startsWith("Umidificador desligado"))).toEqual([
      "Umidificador desligado pelo painel",
    ]);
  });

  it("marca offline quando o broker publica o Last Will do dispositivo", async () => {
    const esp32 = await mqtt.connectAsync(url, {
      clientId: "teste-esp32-luz",
      will: { topic: "ecosense/luz/status", payload: JSON.stringify({ online: false }), qos: 1, retain: true },
    });

    esp32.end(true); // cai sem DISCONNECT, como um ESP32 sem energia

    await vi.waitFor(async () => {
      expect((await device("luz")).online).toBe(false);
    }, ESPERA);
    expect((await events())[0].text).toBe("Iluminação ficou offline");
  });

  it("ignora mensagem inválida sem travar os status seguintes", async () => {
    log.warn.mockClear();

    await dispositivo.publishAsync("ecosense/projetor/status", "isto não é json", { qos: 1 });
    await status("geladeira", { on: true });
    await status("projetor", { on: true, mode: "manual", online: true, fonte: "HDMI 2", autoOff: true, autoOffMin: 15 });

    await vi.waitFor(async () => {
      expect((await device("projetor")).reading.fonte).toBe("HDMI 2");
    }, ESPERA);
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("não é JSON"));
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("dispositivo desconhecido ignorado: geladeira"));
  });

  it("ao conectar, recebe o último status retido de cada dispositivo", async () => {
    await bridge.stop();
    // Publicado com a API desligada: só chega porque o broker guarda (retain).
    await status("projetor", { on: false, mode: "manual", online: true, fonte: "VGA", autoOff: false, autoOffMin: 15 }, { retain: true });

    bridge = await startBridge();

    await vi.waitFor(async () => {
      expect((await device("projetor")).reading).toMatchObject({ fonte: "VGA", autoOff: false });
    }, ESPERA);
  });
});

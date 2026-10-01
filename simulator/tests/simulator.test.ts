import { createServer, type Server } from "node:net";
import type { AddressInfo } from "node:net";
import { createBroker } from "aedes";
import mqtt, { type MqttClient } from "mqtt";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Config } from "../src/config.ts";
import { seededRng } from "../src/devices.ts";
import { Simulator } from "../src/simulator.ts";

/**
 * Ponta a ponta contra um broker em memória (aedes) — sem Docker, sem rede
 * externa. Faz o papel do backend: assina status e publica comandos.
 */

let broker: ReturnType<typeof createBroker>;
let server: Server;
let url: string;
let sim: Simulator;
let backend: MqttClient;
const recebidos: { topic: string; payload: Record<string, unknown> }[] = [];

function esperar(pred: (m: (typeof recebidos)[number]) => boolean, ms = 3000) {
  return new Promise<(typeof recebidos)[number]>((resolve, reject) => {
    const inicio = Date.now();
    const timer = setInterval(() => {
      const achado = recebidos.find(pred);
      if (achado) {
        clearInterval(timer);
        resolve(achado);
      } else if (Date.now() - inicio > ms) {
        clearInterval(timer);
        reject(new Error("mensagem esperada não chegou"));
      }
    }, 20);
  });
}

beforeAll(async () => {
  broker = createBroker();
  server = createServer(broker.handle);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  url = `mqtt://127.0.0.1:${(server.address() as AddressInfo).port}`;

  backend = await mqtt.connectAsync(url);
  await backend.subscribeAsync("ecosense/+/status");
  backend.on("message", (topic, raw) => {
    recebidos.push({ topic, payload: JSON.parse(raw.toString()) });
  });

  const config: Config = {
    mqttUrl: url,
    mqttUsername: undefined,
    mqttPassword: undefined,
    tickMs: 100_000, // física parada: o teste só observa comandos
    speed: 1,
    publishMs: 100_000,
    devices: ["luz", "projetor", "irrigacao", "umidificador"],
    seed: 1,
    verbose: false,
  };
  sim = new Simulator(config, seededRng(1));
  sim.start();
  await esperar((m) => m.topic === "ecosense/umidificador/status");
});

afterAll(async () => {
  await sim.stop();
  await backend.endAsync();
  await new Promise<void>((r) => broker.close(() => r()));
  await new Promise<void>((r) => server.close(() => r()));
});

describe("simulador via MQTT", () => {
  it("publica o status inicial de cada dispositivo", async () => {
    const m = await esperar((m) => m.topic === "ecosense/irrigacao/status");
    expect(m.payload).toMatchObject({ on: false, mode: "auto", online: true, soil: 45 });
  });

  it("responde a um comando publicando o novo status", async () => {
    recebidos.length = 0;
    await backend.publishAsync(
      "ecosense/projetor/cmd",
      JSON.stringify({ action: "power", value: "on" }),
      { qos: 1 },
    );
    const m = await esperar((m) => m.topic === "ecosense/projetor/status");
    expect(m.payload).toMatchObject({ on: true, online: true });
  });

  it("ignora payload inválido sem cair", async () => {
    recebidos.length = 0;
    await backend.publishAsync("ecosense/luz/cmd", "isso não é json");
    await backend.publishAsync("ecosense/luz/cmd", JSON.stringify({ action: "mode", value: "manual" }));
    const m = await esperar((m) => m.topic === "ecosense/luz/status");
    expect(m.payload).toMatchObject({ mode: "manual" });
  });

  it("queda simulada dispara o Last Will (online: false)", async () => {
    recebidos.length = 0;
    sim.goOffline("umidificador");
    const m = await esperar((m) => m.topic === "ecosense/umidificador/status");
    expect(m.payload).toEqual({ online: false });

    recebidos.length = 0;
    sim.goOnline("umidificador");
    const volta = await esperar((m) => m.topic === "ecosense/umidificador/status");
    expect(volta.payload).toMatchObject({ online: true });
  });
});

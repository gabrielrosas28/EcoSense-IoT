import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { applyStatus } from "../src/services/device.service.js";
import { authHeader } from "./support/auth.js";

/**
 * O status que o dispositivo publica em `ecosense/<id>/status`, aplicado
 * direto no service (sem broker). A ponte MQTT tem teste próprio em mqtt.test.js.
 */

const app = createApp();
const auth = authHeader();

const device = async (id) => (await request(app).get(`/api/devices/${id}`).set("Authorization", auth)).body;
const events = async () => (await request(app).get("/api/events?limit=100").set("Authorization", auth)).body;

describe("applyStatus", () => {
  it("grava estado, leituras e o horário em que o dispositivo foi visto", async () => {
    const result = await applyStatus("irrigacao", {
      on: true,
      mode: "auto",
      online: true,
      soil: 22,
      threshold: 30,
      maxPumpSec: 10,
    });

    expect(result.ignored).toEqual([]);
    expect(await device("irrigacao")).toMatchObject({
      on: true,
      online: true,
      reading: { soil: 22, threshold: 30, maxPumpSec: 10 },
      lastSeenAt: expect.any(String),
    });
  });

  it("registra no histórico quando o dispositivo liga ou desliga sozinho", async () => {
    await applyStatus("irrigacao", { on: true });
    await applyStatus("umidificador", { on: false });

    const [ultimo, penultimo] = await events();
    expect(ultimo).toMatchObject({ device: "umidificador", text: "Umidificador desligado pelo dispositivo", source: "device" });
    expect(penultimo).toMatchObject({ device: "irrigacao", text: "Irrigação ligada pelo dispositivo" });
  });

  it("não polui o histórico com heartbeat sem mudança", async () => {
    const antes = (await events()).length;

    // Igual ao seed: só a leitura do sensor muda.
    await applyStatus("luz", { on: true, mode: "auto", online: true, presenca: false, sleepMin: 10 });
    await applyStatus("luz", { on: true, mode: "auto", online: true, presenca: true, sleepMin: 10 });

    expect(await events()).toHaveLength(antes);
    expect((await device("luz")).reading.presenca).toBe(true);
  });

  it("confirma o comando do painel sem duplicar o evento", async () => {
    await request(app).post("/api/devices/projetor/command").set("Authorization", auth).send({ action: "power", value: "on" });
    // O dispositivo responde com o status já ligado: é a confirmação, não uma mudança nova.
    await applyStatus("projetor", { on: true, mode: "manual", online: true });

    const textos = (await events()).map((event) => event.text);
    expect(textos.filter((texto) => texto.startsWith("Projetor ligado"))).toEqual(["Projetor ligado pelo painel"]);
  });

  it("Last Will: marca offline, avisa no histórico e mantém o último horário visto", async () => {
    await applyStatus("umidificador", { air: 60 });
    const vistoEm = (await device("umidificador")).lastSeenAt;

    await applyStatus("umidificador", { online: false });

    const atual = await device("umidificador");
    expect(atual.online).toBe(false);
    expect(atual.lastSeenAt).toBe(vistoEm);
    expect((await events())[0].text).toBe("Umidificador ficou offline");
  });

  it("volta a ficar online com qualquer mensagem do dispositivo", async () => {
    await applyStatus("luz", { online: false });

    await applyStatus("luz", { presenca: true });

    expect((await device("luz")).online).toBe(true);
    expect((await events())[0].text).toBe("Iluminação voltou a ficar online");
  });

  it("ignora campo desconhecido ou inválido sem perder o resto da mensagem", async () => {
    const result = await applyStatus("irrigacao", {
      soil: 150, // sensor fora da faixa física
      air: 40, // sensor de outro dispositivo
      mode: "turbo",
      firmware: "1.2",
      threshold: 25,
    });

    expect(result.ignored).toEqual(["soil", "air", "mode", "firmware"]);
    expect(await device("irrigacao")).toMatchObject({
      mode: "auto",
      reading: { soil: 45, threshold: 25, maxPumpSec: 10 },
    });
  });

  it("devolve null para dispositivo que não existe", async () => {
    expect(await applyStatus("geladeira", { on: true })).toBeNull();
  });
});

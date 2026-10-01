import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { deviceBus } from "../src/lib/deviceBus.js";
import { authHeader } from "./support/auth.js";

const app = createApp();
const auth = authHeader();

const get = (path) => request(app).get(path).set("Authorization", auth);
const command = (id, body) =>
  request(app).post(`/api/devices/${id}/command`).set("Authorization", auth).send(body);
const latestEvent = async () => (await get("/api/events?limit=1")).body[0];

describe("GET /api/devices", () => {
  it("lista os 4 dispositivos na ordem das telas", async () => {
    const res = await get("/api/devices");

    expect(res.status).toBe(200);
    expect(res.body.map((device) => device.id)).toEqual(["luz", "projetor", "irrigacao", "umidificador"]);
  });

  it("usa o mesmo formato do store do frontend", async () => {
    const res = await get("/api/devices/irrigacao");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: "irrigacao",
      name: "Irrigação",
      accent: "var(--leaf)",
      on: false,
      mode: "auto",
      online: true,
      reading: { soil: 45, threshold: 30, maxPumpSec: 10 },
      lastSeenAt: null,
    });
  });

  it("responde 404 para dispositivo que não existe", async () => {
    const res = await get("/api/devices/geladeira");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Dispositivo "geladeira" não existe' });
  });
});

describe("POST /api/devices/:id/command", () => {
  it("liga/desliga, grava no banco e registra no histórico", async () => {
    const res = await command("luz", { action: "power", value: "off" });

    expect(res.status).toBe(202);
    expect(res.body.device.on).toBe(false);
    expect(res.body.topic).toBe("ecosense/luz/cmd");
    expect((await get("/api/devices/luz")).body.on).toBe(false);
    expect(await latestEvent()).toMatchObject({
      device: "luz",
      text: "Iluminação desligada pelo painel",
      source: "user",
    });
  });

  it("aceita booleano no power e concorda o gênero no histórico", async () => {
    await command("projetor", { action: "power", value: true });

    expect((await get("/api/devices/projetor")).body.on).toBe(true);
    expect((await latestEvent()).text).toBe("Projetor ligado pelo painel");
  });

  it("troca o modo", async () => {
    const res = await command("irrigacao", { action: "mode", value: "manual" });

    expect(res.body.device.mode).toBe("manual");
    expect((await latestEvent()).text).toBe("Irrigação em modo manual");
  });

  it("ajusta o limite sem apagar as outras leituras", async () => {
    const res = await command("irrigacao", { action: "threshold", key: "threshold", value: 25 });

    expect(res.status).toBe(202);
    expect(res.body.device.reading).toEqual({ soil: 45, threshold: 25, maxPumpSec: 10 });
  });

  it("aplica config com várias chaves de uma vez", async () => {
    const res = await command("projetor", { action: "config", autoOff: false, autoOffMin: 20 });

    expect(res.body.device.reading).toEqual({ fonte: "HDMI 1", autoOff: false, autoOffMin: 20 });
  });

  it("não registra ajuste de slider no histórico (um arraste viraria dezenas de eventos)", async () => {
    const antes = (await get("/api/events?limit=100")).body.length;

    await command("umidificador", { action: "threshold", key: "threshold", value: 70 });
    await command("umidificador", { action: "config", threshold: 70 });

    expect((await get("/api/events?limit=100")).body).toHaveLength(antes);
  });

  it("troca a fonte do projetor pelo comando IR", async () => {
    const res = await command("projetor", { action: "ir", key: "source:HDMI 2" });

    expect(res.status).toBe(202);
    expect(res.body.device.reading.fonte).toBe("HDMI 2");
  });

  it("repassa as demais teclas IR sem mudar o estado", async () => {
    const antes = (await get("/api/devices/projetor")).body;

    const res = await command("projetor", { action: "ir", key: "vol+" });

    expect(res.status).toBe(202);
    expect(res.body.device).toEqual(antes);
  });

  it("entrega ao barramento o comando já validado (o que o MQTT vai publicar)", async () => {
    const listener = vi.fn();
    deviceBus.on("command", listener);
    try {
      await command("umidificador", { action: "mode", value: "manual", lixo: "ignorado" });
    } finally {
      deviceBus.off("command", listener);
    }

    expect(listener).toHaveBeenCalledWith({
      deviceId: "umidificador",
      topic: "ecosense/umidificador/cmd",
      command: { action: "mode", value: "manual" },
    });
  });

  describe("recusa com 400", () => {
    it.each([
      ["ação desconhecida", "luz", { action: "explodir" }, "action"],
      ["power sem valor", "luz", { action: "power" }, "value"],
      ["modo inexistente", "luz", { action: "mode", value: "turbo" }, "value"],
      ["limite fora da faixa", "irrigacao", { action: "threshold", key: "threshold", value: 200 }, "threshold"],
      ["ajuste que o dispositivo não tem", "luz", { action: "threshold", key: "threshold", value: 30 }, "threshold"],
      ["leitura de sensor (só o dispositivo altera)", "irrigacao", { action: "config", soil: 10 }, "soil"],
      ["fonte que o projetor não tem", "projetor", { action: "ir", key: "source:HDMI 9" }, "fonte"],
      ["tecla IR desconhecida", "projetor", { action: "ir", key: "autodestruir" }, "key"],
    ])("%s", async (_caso, id, body, campo) => {
      const res = await command(id, body);

      expect(res.status).toBe(400);
      expect(res.body.details.map((detail) => detail.campo)).toContain(campo);
    });

    it("comando IR para dispositivo sem infravermelho", async () => {
      const res = await command("luz", { action: "ir", key: "ok" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Iluminação não tem controle por infravermelho");
    });

    it("config sem nenhum ajuste", async () => {
      const res = await command("luz", { action: "config" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Nenhum ajuste informado");
    });

    it("sem gravar nada", async () => {
      const antes = (await get("/api/devices/irrigacao")).body;

      await command("irrigacao", { action: "config", threshold: 25, soil: 10 });

      expect((await get("/api/devices/irrigacao")).body).toEqual(antes);
    });
  });

  it("responde 404 para dispositivo que não existe", async () => {
    const res = await command("geladeira", { action: "power", value: "on" });

    expect(res.status).toBe(404);
  });
});

import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { deviceBus } from "../src/lib/deviceBus.js";
import {
  afterHourChange,
  afterStatus,
  createAutomationClock,
  localHour,
} from "../src/services/automation.service.js";
import { applyStatus } from "../src/services/device.service.js";
import { authHeader } from "./support/auth.js";

/**
 * Motor das rotinas SE → ENTÃO sobre os status do dispositivo (sem broker; a
 * ligação com a ponte MQTT está em mqtt.test.js). Rotinas do seed:
 *   r1  SE solo < 30   ENTÃO ligar irrigação     (ativa)
 *   r2  SE ar < 80     ENTÃO ligar umidificador  (ativa)
 *   r3  SE presença 0  ENTÃO desligar luz        (desativada)
 */

const app = createApp();
const auth = authHeader();

const api = () => ({
  get: (path) => request(app).get(path).set("Authorization", auth),
  post: (path, body) => request(app).post(path).set("Authorization", auth).send(body),
  patch: (path, body) => request(app).patch(path).set("Authorization", auth).send(body),
});
const device = async (id) => (await api().get(`/api/devices/${id}`)).body;
const latestEvent = async () => (await api().get("/api/events?limit=1")).body[0];
const command = (id, body) => api().post(`/api/devices/${id}/command`, body);

/** O status chega, é gravado, e então as rotinas são avaliadas (o que a ponte MQTT faz). */
const status = async (id, payload) => afterStatus(await applyStatus(id, payload));

let comandos;
const capture = (cmd) => comandos.push(cmd);
beforeEach(() => {
  comandos = [];
  deviceBus.on("command", capture);
});
afterEach(() => {
  deviceBus.off("command", capture);
});

describe("rotinas sobre o status do dispositivo", () => {
  it("dispara quando a condição passa a valer: solo secou → liga a irrigação", async () => {
    const results = await status("irrigacao", { soil: 25 });

    expect(results).toEqual([{ routine: "r1", fired: true }]);
    expect(comandos).toEqual([
      { deviceId: "irrigacao", topic: "ecosense/irrigacao/cmd", command: { action: "power", value: "on" } },
    ]);
    expect((await device("irrigacao")).on).toBe(true);
    expect(await latestEvent()).toMatchObject({
      device: "irrigacao",
      text: 'Irrigação ligada pela rotina "umidade do solo menor que 30%"',
      source: "routine",
    });
  });

  it("não dispara de novo enquanto a condição continua valendo (só na borda)", async () => {
    await status("irrigacao", { soil: 25 });
    comandos.length = 0;

    // A bomba desligou sozinha pela trava de tempo e o solo segue seco.
    const results = await status("irrigacao", { on: false, soil: 24 });

    expect(results).toEqual([]);
    expect(comandos).toEqual([]);
  });

  it("dispara de novo depois que a condição deixa de valer e volta", async () => {
    await status("irrigacao", { soil: 25 });
    await status("irrigacao", { on: false, soil: 50 });
    comandos.length = 0;

    await status("irrigacao", { soil: 28 });

    expect(comandos.map((c) => c.deviceId)).toEqual(["irrigacao"]);
  });

  it("respeita o modo manual (override do usuário)", async () => {
    await command("irrigacao", { action: "mode", value: "manual" });
    comandos.length = 0;

    const results = await status("irrigacao", { soil: 20 });

    expect(results).toEqual([{ routine: "r1", fired: false, reason: "dispositivo em modo manual" }]);
    expect(comandos).toEqual([]);
    expect((await device("irrigacao")).on).toBe(false);
  });

  it("não manda comando se o dispositivo já está no estado pedido", async () => {
    await status("umidificador", { air: 85 }); // condição deixa de valer

    const results = await status("umidificador", { air: 70 }); // volta a valer, mas já está ligado

    expect(results).toEqual([{ routine: "r2", fired: false, reason: "já estava ligado" }]);
    expect(comandos).toEqual([]);
  });

  it("não manda comando para dispositivo offline", async () => {
    await api().post("/api/routines", { sensor: "soil", operator: "lt", value: 30, action: "off", device: "projetor" });
    await applyStatus("projetor", { online: false });

    const results = await status("irrigacao", { soil: 25 });

    expect(results).toContainEqual({ routine: expect.any(String), fired: false, reason: "dispositivo offline" });
    expect(comandos.map((c) => c.deviceId)).toEqual(["irrigacao"]);
  });

  it("rotina desativada não dispara", async () => {
    const results = await status("luz", { presenca: false });

    expect(results).toEqual([]);
    expect((await device("luz")).on).toBe(true);
  });

  it("rotina ativada passa a valer: sem presença → desliga a luz", async () => {
    await api().patch("/api/routines/r3", { enabled: true });

    await status("luz", { presenca: false });

    expect((await device("luz")).on).toBe(false);
    expect((await latestEvent()).text).toBe('Iluminação desligada pela rotina "presença não detectada"');
  });

  it("cruza dispositivos: sala vazia → desliga o projetor", async () => {
    await api().post("/api/routines", { sensor: "presenca", operator: "eq", value: 0, action: "off", device: "projetor" });
    await command("projetor", { action: "mode", value: "auto" });
    await command("projetor", { action: "power", value: "on" });
    comandos.length = 0;

    await status("luz", { presenca: false });

    expect(comandos).toEqual([expect.objectContaining({ deviceId: "projetor", command: { action: "power", value: "off" } })]);
    expect((await device("projetor")).on).toBe(false);
  });

  it("status de dispositivo sem sensor não avalia nada", async () => {
    expect(await status("projetor", { on: true })).toEqual([]);
  });
});

describe("rotinas de horário", () => {
  beforeEach(async () => {
    await api().post("/api/routines", { id: "r-7h", sensor: "hora", operator: "eq", value: 7, action: "on", device: "luz" });
    await command("luz", { action: "power", value: "off" });
    comandos.length = 0;
  });

  it("dispara quando a hora vira", async () => {
    expect(await afterHourChange(6, 7)).toEqual([{ routine: "r-7h", fired: true }]);
    expect((await device("luz")).on).toBe(true);
    expect((await latestEvent()).text).toBe('Iluminação ligada pela rotina "horário igual a 7h"');
  });

  it("não dispara nas outras viradas", async () => {
    expect(await afterHourChange(7, 8)).toEqual([]);
    expect(comandos).toEqual([]);
  });

  it("o relógio usa a hora do fuso da escola e só age na virada", async () => {
    let agora = new Date("2026-10-06T09:59:00Z"); // 06:59 em São Paulo
    const relogio = createAutomationClock({ now: () => agora, log: { info() {}, error() {} } });

    await relogio.check(); // primeira leitura: só memoriza a hora
    expect(comandos).toEqual([]);

    agora = new Date("2026-10-06T10:00:00Z"); // 07:00 em São Paulo
    await relogio.check();

    expect(localHour(agora)).toBe(7);
    expect(comandos.map((c) => c.deviceId)).toEqual(["luz"]);
    await relogio.stop();
  });
});

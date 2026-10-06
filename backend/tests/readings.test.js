import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { pool } from "../src/database/pool.js";
import { applyStatus } from "../src/services/device.service.js";
import { authHeader } from "./support/auth.js";

const app = createApp();
const auth = authHeader();

const readings = (id, query = {}) =>
  request(app).get(`/api/devices/${id}/readings`).query(query).set("Authorization", auth);

/** Amostras com horário fixo, longe das 24 h que o seed preenche. */
async function insert(deviceId, sensor, points) {
  for (const [at, value] of points) {
    await pool.query("INSERT INTO readings (device_id, sensor, value, recorded_at) VALUES ($1, $2, $3, $4)", [
      deviceId,
      sensor,
      value,
      at,
    ]);
  }
}

const JAN_10 = { from: "2026-01-10T00:00:00Z", to: "2026-01-11T00:00:00Z" };

describe("GET /api/devices/:id/readings", () => {
  it("sem filtros, devolve as últimas 24 h de cada sensor, em ordem cronológica", async () => {
    const res = await readings("irrigacao");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ device: "irrigacao", interval: null });
    expect(Object.keys(res.body.series)).toEqual(["soil"]);

    const soil = res.body.series.soil;
    expect(soil).toHaveLength(96); // seed: uma amostra a cada 15 min
    expect(soil[0]).toEqual({ at: expect.any(String), value: expect.any(Number) });
    const instantes = soil.map((point) => Date.parse(point.at));
    expect(instantes).toEqual([...instantes].sort((a, b) => a - b));
    expect(Date.parse(res.body.to) - Date.parse(res.body.from)).toBe(24 * 60 * 60 * 1000);
  });

  it("filtra por sensor e período, e o limit fica com as amostras mais recentes", async () => {
    await insert("umidificador", "air", [
      ["2026-01-10T10:00:00Z", 50],
      ["2026-01-10T10:05:00Z", 52],
      ["2026-01-10T10:10:00Z", 54],
      ["2026-01-11T10:00:00Z", 99], // fora do período
    ]);

    const res = await readings("umidificador", { sensor: "air", ...JAN_10, limit: 2 });

    expect(res.status).toBe(200);
    expect(res.body.series).toEqual({
      air: [
        { at: "2026-01-10T10:05:00.000Z", value: 52 },
        { at: "2026-01-10T10:10:00.000Z", value: 54 },
      ],
    });
  });

  it("devolve presença como booleano", async () => {
    await insert("luz", "presenca", [
      ["2026-01-10T10:00:00Z", 1],
      ["2026-01-10T12:00:00Z", 0],
    ]);

    const res = await readings("luz", JAN_10);

    expect(res.body.series.presenca.map((point) => point.value)).toEqual([true, false]);
  });

  it("dispositivo sem sensor responde com a série vazia", async () => {
    const res = await readings("projetor");

    expect(res.status).toBe(200);
    expect(res.body.series).toEqual({});
  });

  it("período sem amostras mantém o sensor na resposta, com lista vazia", async () => {
    const res = await readings("irrigacao", JAN_10);

    expect(res.body.series).toEqual({ soil: [] });
  });

  it("com interval, agrega em janelas com média, mínimo, máximo e contagem", async () => {
    await insert("irrigacao", "soil", [
      ["2026-01-10T10:00:00Z", 40],
      ["2026-01-10T10:05:00Z", 43],
      ["2026-01-10T10:14:59Z", 44],
      ["2026-01-10T10:20:00Z", 38],
    ]);

    const res = await readings("irrigacao", { ...JAN_10, interval: "15m" });

    expect(res.status).toBe(200);
    expect(res.body.interval).toBe("15m");
    expect(res.body.series.soil).toEqual([
      { at: "2026-01-10T10:00:00.000Z", value: 42.33, min: 40, max: 44, count: 3 },
      { at: "2026-01-10T10:15:00.000Z", value: 38, min: 38, max: 38, count: 1 },
    ]);
  });

  it("a janela de 1 dia começa à meia-noite do fuso da escola, não em UTC", async () => {
    await insert("irrigacao", "soil", [
      ["2026-01-10T02:00:00Z", 30], // 23h do dia 9 em São Paulo
      ["2026-01-10T04:00:00Z", 50], // 1h do dia 10 em São Paulo
    ]);

    const res = await readings("irrigacao", { ...JAN_10, interval: "1d" });

    expect(res.body.series.soil.map(({ at, value }) => ({ at, value }))).toEqual([
      { at: "2026-01-09T03:00:00.000Z", value: 30 },
      { at: "2026-01-10T03:00:00.000Z", value: 50 },
    ]);
  });

  it("na presença agregada, a média é a fração do tempo com alguém na sala", async () => {
    await insert("luz", "presenca", [
      ["2026-01-10T10:00:00Z", 1],
      ["2026-01-10T10:15:00Z", 1],
      ["2026-01-10T10:30:00Z", 1],
      ["2026-01-10T10:45:00Z", 0],
    ]);

    const res = await readings("luz", { ...JAN_10, interval: "1h" });

    expect(res.body.series.presenca).toEqual([
      { at: "2026-01-10T10:00:00.000Z", value: 0.75, min: 0, max: 1, count: 4 },
    ]);
  });

  it("responde 400 para sensor que o dispositivo não tem", async () => {
    const res = await readings("irrigacao", { sensor: "air" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'Sensor "air" não existe em Irrigação',
      details: [{ campo: "sensor", erro: "use um destes: soil" }],
    });
  });

  it("responde 400 para data, janela ou limite inválidos", async () => {
    for (const query of [
      { from: "ontem" },
      { interval: "2h" },
      { limit: 0 },
      { from: "2026-01-11T00:00:00Z", to: "2026-01-10T00:00:00Z" },
    ]) {
      const res = await readings("irrigacao", query);
      expect({ query, status: res.status, error: res.body.error }).toEqual({
        query,
        status: 400,
        error: "Parâmetro de consulta inválido",
      });
    }
  });

  it("responde 404 para dispositivo que não existe", async () => {
    const res = await readings("geladeira");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Dispositivo "geladeira" não existe' });
  });

  it("exige login", async () => {
    const res = await request(app).get("/api/devices/irrigacao/readings");

    expect(res.status).toBe(401);
  });
});

describe("gravação da série pelo status do dispositivo", () => {
  const ultimas = async (id) => (await readings(id, { limit: 1 })).body.series;

  it("cada status vira uma amostra de cada sensor; ajuste do painel não entra", async () => {
    await applyStatus("irrigacao", { on: true, soil: 21, threshold: 30, maxPumpSec: 10 });
    await applyStatus("luz", { presenca: false, sleepMin: 10 });

    expect(await ultimas("irrigacao")).toEqual({ soil: [{ at: expect.any(String), value: 21 }] });
    expect(await ultimas("luz")).toEqual({ presenca: [{ at: expect.any(String), value: false }] });

    const { rows } = await pool.query("SELECT DISTINCT sensor FROM readings ORDER BY sensor");
    expect(rows.map((row) => row.sensor)).toEqual(["air", "presenca", "soil"]);
  });

  it("valor fora da faixa ou sensor de outro dispositivo não entra na série", async () => {
    const antes = (await pool.query("SELECT count(*)::int AS n FROM readings")).rows[0].n;

    await applyStatus("irrigacao", { soil: 150, air: 40 });
    // Last Will: sem leitura, não grava nada.
    await applyStatus("umidificador", { online: false });

    expect((await pool.query("SELECT count(*)::int AS n FROM readings")).rows[0].n).toBe(antes);
  });
});

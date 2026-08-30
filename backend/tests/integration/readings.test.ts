import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/prisma.ts", () => import("../helpers/prismaMock.ts"));

import { createApp } from "../../src/app.ts";
import { ENV_ID, deviceRow, environmentRow } from "../helpers/fixtures.ts";
import { prisma, resetPrismaMock } from "../helpers/prismaMock.ts";

const app = createApp();

/**
 * A série temporal (`readings`) é alimentada pelo status que o dispositivo
 * reporta. O que entra ali precisa ser medição — nunca configuração do usuário.
 */
beforeEach(() => {
  resetPrismaMock();
  prisma.device.findUnique.mockResolvedValue({
    ...deviceRow(),
    environment: environmentRow(),
  });
  prisma.device.update.mockResolvedValue({
    ...deviceRow(),
    environment: environmentRow(),
  });
});

describe("gravação de leituras de sensores", () => {
  it("grava a medição com unidade e o ambiente do dispositivo", async () => {
    await request(app).post("/api/devices/irrigacao/status").send({ soil: 22 });

    expect(prisma.reading.createMany).toHaveBeenCalledWith({
      data: [
        {
          deviceId: deviceRow().id,
          environmentId: ENV_ID,
          metric: "soil",
          value: 22,
          unit: "%",
        },
      ],
    });
  });

  it("grava várias métricas de um mesmo payload", async () => {
    await request(app)
      .post("/api/devices/irrigacao/status")
      .send({ soil: 30, temperatura: 24.5, consumo: 12 });

    const data = prisma.reading.createMany.mock.calls[0]?.[0]?.data;
    expect(data.map((l: { metric: string }) => l.metric)).toEqual([
      "soil",
      "temperatura",
      "consumo",
    ]);
  });

  it("ignora configuração do usuário — threshold não é leitura de sensor", async () => {
    await request(app)
      .post("/api/devices/irrigacao/status")
      .send({ soil: 40, threshold: 35, maxPumpSec: 12 });

    const data = prisma.reading.createMany.mock.calls[0]?.[0]?.data;
    expect(data).toHaveLength(1);
    expect(data[0].metric).toBe("soil");
  });

  it("converte presença (booleano) em 1/0, para caber num gráfico", async () => {
    await request(app).post("/api/devices/luz/status").send({ presenca: true });

    const data = prisma.reading.createMany.mock.calls[0]?.[0]?.data;
    expect(data[0]).toMatchObject({ metric: "presenca", value: 1, unit: null });
  });

  it("não grava nada quando o payload não traz medição alguma", async () => {
    await request(app).post("/api/devices/luz/status").send({ on: true, online: true });

    expect(prisma.reading.createMany).not.toHaveBeenCalled();
  });

  it("descarta valor não numérico em vez de gravar NaN", async () => {
    await request(app).post("/api/devices/irrigacao/status").send({ soil: "molhado" });

    expect(prisma.reading.createMany).not.toHaveBeenCalled();
  });

  it("aceita dispositivo sem ambiente (environmentId nulo na leitura)", async () => {
    prisma.device.findUnique.mockResolvedValue({
      ...deviceRow({ environmentId: null }),
      environment: null,
    });

    await request(app).post("/api/devices/irrigacao/status").send({ soil: 15 });

    const data = prisma.reading.createMany.mock.calls[0]?.[0]?.data;
    expect(data[0].environmentId).toBeNull();
  });

  it("comando do painel não gera leitura — só status do dispositivo gera", async () => {
    await request(app)
      .post("/api/devices/irrigacao/command")
      .send({ action: "threshold", key: "threshold", value: 25 });

    expect(prisma.reading.createMany).not.toHaveBeenCalled();
  });
});

describe("dispositivo e ambiente", () => {
  it("devolve o ambiente junto do dispositivo", async () => {
    const res = await request(app).get("/api/devices/irrigacao");

    expect(res.status).toBe(200);
    expect(res.body.environment).toEqual({ id: "sala-101", name: "Sala 101" });
  });

  it("carrega o ambiente na listagem, sem consulta extra por dispositivo", async () => {
    prisma.device.findMany.mockResolvedValue([
      { ...deviceRow(), environment: environmentRow() },
    ]);

    await request(app).get("/api/devices");

    expect(prisma.device.findMany).toHaveBeenCalledWith({
      include: { environment: true },
    });
  });
});

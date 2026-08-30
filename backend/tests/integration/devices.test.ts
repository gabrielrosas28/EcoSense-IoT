import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/prisma.ts", () => import("../helpers/prismaMock.ts"));

import { createApp } from "../../src/app.ts";
import { deviceRow } from "../helpers/fixtures.ts";
import { prisma, resetPrismaMock } from "../helpers/prismaMock.ts";

const app = createApp();

beforeEach(() => {
  resetPrismaMock();
});

describe("GET /api/devices", () => {
  it("devolve os dispositivos na ordem das telas, não na do banco", async () => {
    prisma.device.findMany.mockResolvedValue([
      deviceRow({ slug: "umidificador", name: "Umidificador" }),
      deviceRow({ slug: "luz", name: "Iluminação" }),
      deviceRow({ slug: "irrigacao", name: "Irrigação" }),
      deviceRow({ slug: "projetor", name: "Projetor" }),
    ]);

    const res = await request(app).get("/api/devices");

    expect(res.status).toBe(200);
    expect(res.body.map((d: { id: string }) => d.id)).toEqual([
      "luz",
      "projetor",
      "irrigacao",
      "umidificador",
    ]);
  });
});

describe("GET /api/devices/:slug", () => {
  it("devolve o dispositivo no formato do store", async () => {
    prisma.device.findUnique.mockResolvedValue(deviceRow());

    const res = await request(app).get("/api/devices/irrigacao");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: "irrigacao",
      on: false,
      mode: "auto",
      reading: { soil: 45, threshold: 30 },
    });
  });

  it("recusa slug fora dos 4 subsistemas antes de tocar no banco", async () => {
    const res = await request(app).get("/api/devices/geladeira");

    expect(res.status).toBe(400);
    expect(prisma.device.findUnique).not.toHaveBeenCalled();
  });

  it("responde 404 quando o slug é válido mas não existe no banco", async () => {
    prisma.device.findUnique.mockResolvedValue(null);

    const res = await request(app).get("/api/devices/luz");

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("luz");
  });
});

describe("POST /api/devices/:slug/command", () => {
  it("liga o dispositivo e devolve o estado já atualizado", async () => {
    prisma.device.findUnique.mockResolvedValue(deviceRow({ isOn: false }));
    prisma.device.update.mockResolvedValue(deviceRow({ isOn: true }));

    const res = await request(app)
      .post("/api/devices/irrigacao/command")
      .send({ action: "power", value: "on" });

    expect(res.status).toBe(202);
    expect(res.body.device.on).toBe(true);
    expect(prisma.device.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isOn: true } }),
    );
  });

  it("publica no tópico MQTT do dispositivo", async () => {
    prisma.device.findUnique.mockResolvedValue(deviceRow());
    prisma.device.update.mockResolvedValue(deviceRow());

    const res = await request(app)
      .post("/api/devices/irrigacao/command")
      .send({ action: "power", value: "off" });

    expect(res.body.topic).toBe("ecosense/irrigacao/cmd");
  });

  it("faz patch em settings no threshold, sem apagar as outras chaves", async () => {
    prisma.device.findUnique.mockResolvedValue(deviceRow());
    prisma.device.update.mockResolvedValue(deviceRow());

    await request(app)
      .post("/api/devices/irrigacao/command")
      .send({ action: "threshold", key: "threshold", value: 25 });

    expect(prisma.device.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { settings: { soil: 45, threshold: 25, maxPumpSec: 10 } },
      }),
    );
  });

  it("exige `key` no comando de threshold", async () => {
    prisma.device.findUnique.mockResolvedValue(deviceRow());

    const res = await request(app)
      .post("/api/devices/irrigacao/command")
      .send({ action: "threshold", value: 25 });

    expect(res.status).toBe(400);
    expect(prisma.device.update).not.toHaveBeenCalled();
  });

  it("registra o comando no histórico e na auditoria", async () => {
    prisma.device.findUnique.mockResolvedValue(deviceRow());
    prisma.device.update.mockResolvedValue(deviceRow({ isOn: true }));

    await request(app)
      .post("/api/devices/irrigacao/command")
      .send({ action: "power", value: "on" });

    expect(prisma.command.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "power", status: "SENT" }),
      }),
    );
    expect(prisma.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: "USER" }),
      }),
    );
  });

  it("aceita comando de IR do projetor sem alterar estado no banco", async () => {
    prisma.device.findUnique.mockResolvedValue(deviceRow({ slug: "projetor" }));
    prisma.device.update.mockResolvedValue(deviceRow({ slug: "projetor" }));

    const res = await request(app)
      .post("/api/devices/projetor/command")
      .send({ action: "ir", key: "volume_up" });

    expect(res.status).toBe(202);
    expect(prisma.device.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: {} }),
    );
  });

  it("rejeita comando sem `action`", async () => {
    const res = await request(app).post("/api/devices/luz/command").send({ value: "on" });

    expect(res.status).toBe(400);
    expect(res.body.details[0].campo).toBe("action");
  });
});

describe("POST /api/devices/:slug/status", () => {
  it("grava o estado reportado pelo device sem republicar comando", async () => {
    prisma.device.findUnique.mockResolvedValue(deviceRow());
    prisma.device.update.mockResolvedValue(deviceRow({ isOn: true, online: true }));

    const res = await request(app)
      .post("/api/devices/irrigacao/status")
      .send({ on: true, online: true, soil: 22 });

    expect(res.status).toBe(200);
    // Nenhum comando registrado: status é via de mão única, senão vira laço.
    expect(prisma.command.create).not.toHaveBeenCalled();
    expect(prisma.device.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isOn: true,
          online: true,
          settings: { soil: 22, threshold: 30, maxPumpSec: 10 },
        }),
      }),
    );
  });

  it("marca `lastSeen` a cada status recebido", async () => {
    prisma.device.findUnique.mockResolvedValue(deviceRow());
    prisma.device.update.mockResolvedValue(deviceRow());

    await request(app).post("/api/devices/luz/status").send({ online: true });

    const data = prisma.device.update.mock.calls[0]?.[0]?.data;
    expect(data.lastSeen).toBeInstanceOf(Date);
  });
});

describe("GET /api/devices/events", () => {
  it("respeita o limite e não colide com a rota /:slug", async () => {
    prisma.event.findMany.mockResolvedValue([]);

    const res = await request(app).get("/api/devices/events?limit=5");

    expect(res.status).toBe(200);
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 }),
    );
  });

  it("recusa limite fora da faixa", async () => {
    const res = await request(app).get("/api/devices/events?limit=9999");
    expect(res.status).toBe(400);
  });
});

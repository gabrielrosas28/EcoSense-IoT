import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/prisma.ts", () => import("../helpers/prismaMock.ts"));

import { createApp } from "../../src/app.ts";
import { deviceRow, routineRow } from "../helpers/fixtures.ts";
import { prisma, resetPrismaMock } from "../helpers/prismaMock.ts";

const app = createApp();

const ID = routineRow().id;

const novaRotina = {
  sensor: "soil",
  operator: "<",
  value: 30,
  action: "ligar",
  device: "irrigacao",
};

beforeEach(() => {
  resetPrismaMock();
});

describe("GET /api/routines", () => {
  it("estrutura cada rotina em `if` / `then`", async () => {
    prisma.routine.findMany.mockResolvedValue([routineRow()]);

    const res = await request(app).get("/api/routines");

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({
      enabled: true,
      if: { sensor: "soil", operator: "<", value: 30 },
      then: { action: "ligar", device: "irrigacao" },
    });
  });
});

describe("POST /api/routines", () => {
  it("cria a rotina e resolve o slug para o id do dispositivo", async () => {
    prisma.device.findUnique.mockResolvedValue(deviceRow());
    prisma.routine.create.mockResolvedValue(routineRow());

    const res = await request(app).post("/api/routines").send(novaRotina);

    expect(res.status).toBe(201);
    expect(prisma.routine.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deviceId: deviceRow().id, enabled: true }),
      }),
    );
  });

  it("gera um nome legível quando nenhum é informado", async () => {
    prisma.device.findUnique.mockResolvedValue(deviceRow());
    prisma.routine.create.mockResolvedValue(routineRow());

    await request(app).post("/api/routines").send(novaRotina);

    const data = prisma.routine.create.mock.calls[0]?.[0]?.data;
    expect(data.name).toBe("Se soil < 30 então ligar Irrigação");
  });

  it("recusa operador que não existe", async () => {
    const res = await request(app)
      .post("/api/routines")
      .send({ ...novaRotina, operator: "=>" });

    expect(res.status).toBe(400);
    expect(res.body.details[0].campo).toBe("operator");
    expect(prisma.routine.create).not.toHaveBeenCalled();
  });

  it("recusa dispositivo fora dos 4 subsistemas", async () => {
    const res = await request(app)
      .post("/api/routines")
      .send({ ...novaRotina, device: "geladeira" });

    expect(res.status).toBe(400);
  });

  it("recusa valor que não é número", async () => {
    const res = await request(app)
      .post("/api/routines")
      .send({ ...novaRotina, value: "trinta" });

    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/routines/:id", () => {
  it("desativa a rotina (o toggle da tela de Rotinas)", async () => {
    prisma.routine.update.mockResolvedValue(routineRow({ enabled: false }));

    const res = await request(app).patch(`/api/routines/${ID}`).send({ enabled: false });

    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
    expect(prisma.routine.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ID }, data: { enabled: false } }),
    );
  });

  it("recusa id que não é UUID", async () => {
    const res = await request(app).patch("/api/routines/123").send({ enabled: false });

    expect(res.status).toBe(400);
    expect(prisma.routine.update).not.toHaveBeenCalled();
  });

  it("recusa patch vazio", async () => {
    const res = await request(app).patch(`/api/routines/${ID}`).send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Nada para atualizar");
  });

  it("traduz P2025 do Prisma em 404", async () => {
    prisma.routine.update.mockRejectedValue(
      Object.assign(new Error("not found"), { code: "P2025" }),
    );

    const res = await request(app).patch(`/api/routines/${ID}`).send({ enabled: true });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("P2025");
  });
});

describe("DELETE /api/routines/:id", () => {
  it("remove e responde 204 sem corpo", async () => {
    prisma.routine.delete.mockResolvedValue(routineRow());

    const res = await request(app).delete(`/api/routines/${ID}`);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });
});

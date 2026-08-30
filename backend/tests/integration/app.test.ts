import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/prisma.ts", () => import("../helpers/prismaMock.ts"));

import { createApp } from "../../src/app.ts";
import { prisma, resetPrismaMock } from "../helpers/prismaMock.ts";

const app = createApp();

beforeEach(() => {
  resetPrismaMock();
});

describe("GET /api", () => {
  it("lista os recursos disponíveis", async () => {
    const res = await request(app).get("/api");

    expect(res.status).toBe(200);
    expect(res.body.endpoints).toContain("/api/devices");
  });
});

describe("GET /api/health", () => {
  it("responde ok quando o banco responde", async () => {
    prisma.$queryRaw.mockResolvedValue([{ ok: 1 }]);

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", database: "up" });
  });

  it("responde 503 quando o banco está fora", async () => {
    prisma.$queryRaw.mockRejectedValue(new Error("connection refused"));

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: "degraded", database: "down" });
  });
});

describe("tratamento de erro", () => {
  it("responde 404 em JSON para rota inexistente", async () => {
    const res = await request(app).get("/api/nao-existe");

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("GET /api/nao-existe");
  });

  it("responde 500 sem vazar detalhe interno em erro inesperado", async () => {
    prisma.device.findMany.mockRejectedValue(new Error("segredo do banco"));

    const res = await request(app).get("/api/devices");

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Erro interno do servidor");
  });
});

describe("CORS", () => {
  it("responde com o header de origem permitida", async () => {
    const res = await request(app).get("/api").set("Origin", "http://localhost:5173");

    expect(res.headers["access-control-allow-origin"]).toBeDefined();
  });
});

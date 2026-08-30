import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/prisma.ts", () => import("../helpers/prismaMock.ts"));

import { createApp } from "../../src/app.ts";
import { userRow } from "../helpers/fixtures.ts";
import { prisma, resetPrismaMock } from "../helpers/prismaMock.ts";

const app = createApp();

const SENHA = "ecosense123";

beforeEach(() => {
  resetPrismaMock();
});

describe("POST /api/auth/login", () => {
  it("devolve token e usuário com credenciais válidas", async () => {
    prisma.user.findUnique.mockResolvedValue(userRow());

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@ecosense.local", password: SENHA });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({
      id: userRow().id,
      email: "admin@ecosense.local",
      name: "Administrador",
    });
  });

  it("nunca devolve o hash da senha", async () => {
    prisma.user.findUnique.mockResolvedValue(userRow());

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@ecosense.local", password: SENHA });

    expect(JSON.stringify(res.body)).not.toContain("$2b$");
  });

  it("rejeita senha errada", async () => {
    prisma.user.findUnique.mockResolvedValue(userRow());

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@ecosense.local", password: "senha-errada" });

    expect(res.status).toBe(401);
  });

  it("dá a mesma resposta para e-mail inexistente e senha errada", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ninguem@ecosense.local", password: SENHA });

    // Mensagem genérica de propósito: não revela quais e-mails existem.
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("E-mail ou senha inválidos");
  });

  it("valida o corpo antes de consultar o banco", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nao-e-email", password: "123" });

    expect(res.status).toBe(400);
    expect(res.body.details).toHaveLength(2);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("GET /api/auth/me", () => {
  it("recusa requisição sem token", async () => {
    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Token ausente");
  });

  it("recusa token adulterado", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer nao.e.um.token");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Token inválido ou expirado");
  });

  it("devolve o usuário do token emitido no login", async () => {
    prisma.user.findUnique.mockResolvedValue(userRow());

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@ecosense.local", password: SENHA });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe("admin@ecosense.local");
  });
});

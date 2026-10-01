import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { pool } from "../src/database/pool.js";
import { authHeader } from "./support/auth.js";

const app = createApp();

describe("GET /api", () => {
  it("se apresenta e aponta para o health check", async () => {
    const res = await request(app).get("/api");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: "EcoSense IoT API", health: "/api/health" });
  });
});

describe("GET /api/health", () => {
  it("responde ok com o banco no ar", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", database: "up" });
  });

  it("responde 503 quando o banco não responde", async () => {
    vi.spyOn(pool, "query").mockRejectedValueOnce(new Error("connection refused"));

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: "degraded", database: "down" });
  });
});

describe("tratamento de erro", () => {
  it("responde 404 em JSON para rota que não existe", async () => {
    const res = await request(app).get("/api/nao-existe");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Rota não encontrada: GET /api/nao-existe" });
  });

  it("responde 400 para JSON malformado", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email":');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "O corpo da requisição não é um JSON válido" });
  });

  it("responde 500 sem vazar o erro interno", async () => {
    vi.spyOn(pool, "query").mockRejectedValueOnce(new Error("detalhe interno do banco"));

    const res = await request(app).get("/api/devices").set("Authorization", authHeader());

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Erro interno do servidor" });
  });
});

describe("cabeçalhos", () => {
  it("libera CORS para o frontend", async () => {
    const res = await request(app).get("/api").set("Origin", "http://localhost:5173");

    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("não libera CORS para origem desconhecida", async () => {
    const res = await request(app).get("/api").set("Origin", "http://site-qualquer.com");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("não anuncia que é Express", async () => {
    const res = await request(app).get("/api");

    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

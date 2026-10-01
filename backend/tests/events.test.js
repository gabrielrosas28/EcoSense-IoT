import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { pool } from "../src/database/pool.js";
import { authHeader } from "./support/auth.js";

const app = createApp();
const auth = authHeader();

const get = (path) => request(app).get(path).set("Authorization", auth);

describe("GET /api/events", () => {
  it("lista do mais recente para o mais antigo, no formato do EventList", async () => {
    const res = await get("/api/events");

    expect(res.status).toBe(200);
    expect(res.body.map((event) => event.device)).toEqual(["irrigacao", "umidificador", "luz", "projetor"]);
    expect(res.body[0]).toEqual({
      id: expect.any(String),
      device: "irrigacao",
      text: "Irrigação concluída — 8 s de bomba",
      source: "device",
      createdAt: expect.any(String),
      at: expect.stringMatching(/^\d{2}:\d{2}$/),
    });
  });

  it("mostra a hora no fuso configurado (APP_TIMEZONE)", async () => {
    await pool.query(
      "INSERT INTO events (device_id, message, created_at) VALUES ('luz', 'teste de fuso', '2099-01-01T10:12:00Z')",
    );

    const [event] = (await get("/api/events?limit=1")).body;

    expect(event.text).toBe("teste de fuso");
    expect(event.at).toBe("07:12"); // 10:12 UTC = 07:12 em São Paulo
  });

  it("respeita o limit", async () => {
    const res = await get("/api/events?limit=2");

    expect(res.body).toHaveLength(2);
  });

  it("filtra por dispositivo", async () => {
    const res = await get("/api/events?device=luz");

    expect(res.body.map((event) => event.device)).toEqual(["luz"]);
  });

  it("recusa limit fora da faixa", async () => {
    const res = await get("/api/events?limit=500");

    expect(res.status).toBe(400);
    expect(res.body.details[0].campo).toBe("limit");
  });
});

import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { authHeader } from "./support/auth.js";

const app = createApp();
const auth = authHeader();

const list = () => request(app).get("/api/routines").set("Authorization", auth);
const create = (body) => request(app).post("/api/routines").set("Authorization", auth).send(body);
const update = (id, body) => request(app).patch(`/api/routines/${id}`).set("Authorization", auth).send(body);
const remove = (id) => request(app).delete(`/api/routines/${id}`).set("Authorization", auth);

const valid = { sensor: "soil", operator: "lt", value: 20, action: "on", device: "irrigacao" };

describe("GET /api/routines", () => {
  it("lista as rotinas no formato do store do frontend, mais antigas primeiro", async () => {
    const res = await list();

    expect(res.status).toBe(200);
    expect(res.body.map((routine) => routine.id)).toEqual(["r1", "r2", "r3"]);
    expect(res.body[0]).toEqual({
      id: "r1",
      sensor: "soil",
      operator: "lt",
      value: 30,
      action: "on",
      device: "irrigacao",
      enabled: true,
      createdAt: expect.any(String),
    });
  });
});

describe("POST /api/routines", () => {
  it("aceita o que a tela de Rotinas envia, e o toggle e a remoção usam o mesmo id", async () => {
    // Exatamente o objeto de store/useRoutines.js → add(): id gerado na tela.
    const daTela = {
      id: "r-1727790000000-0",
      enabled: true,
      sensor: "air",
      operator: "gt",
      value: 70,
      action: "off",
      device: "umidificador",
    };

    const res = await create(daTela);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject(daTela);
    expect((await update(daTela.id, { enabled: false })).body.enabled).toBe(false);
    expect((await remove(daTela.id)).status).toBe(204);
  });

  it("gera o id e ativa a rotina quando o cliente não informa", async () => {
    const res = await create(valid);

    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.enabled).toBe(true);
    expect((await list()).body.at(-1).id).toBe(res.body.id);
  });

  it("aceita presença detectada/não detectada com o operador eq", async () => {
    const res = await create({ sensor: "presenca", operator: "eq", value: 1, action: "on", device: "luz" });

    expect(res.status).toBe(201);
  });

  it("recusa id repetido com 409", async () => {
    const res = await create({ ...valid, id: "r1" });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Já existe uma rotina com o id "r1"' });
  });

  it.each([
    ["operador fora do vocabulário", { operator: "menor" }, "operator"],
    ["valor que não é número", { value: "trinta" }, "value"],
    ["sensor desconhecido", { sensor: "temperatura" }, "sensor"],
    ["ação desconhecida", { action: "piscar" }, "action"],
    ["umidade acima de 100%", { value: 120 }, "value"],
    ["hora inexistente", { sensor: "hora", value: 25 }, "value"],
    ["presença com operador diferente de eq", { sensor: "presenca", operator: "lt", value: 1 }, "operator"],
    ["presença com valor diferente de 0 e 1", { sensor: "presenca", operator: "eq", value: 30 }, "value"],
    ["dispositivo que não existe", { device: "geladeira" }, "device"],
    ["id com caracteres inválidos", { id: "r 1/../x" }, "id"],
  ])("recusa %s", async (_caso, override, campo) => {
    const res = await create({ ...valid, ...override });

    expect(res.status).toBe(400);
    expect(res.body.details.map((detail) => detail.campo)).toContain(campo);
  });
});

describe("PATCH /api/routines/:id", () => {
  it("desativa a rotina (o interruptor da tela)", async () => {
    const res = await update("r1", { enabled: false });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "r1", enabled: false, sensor: "soil" });
  });

  it("revalida a rotina inteira depois de aplicar o patch", async () => {
    // r3 é de presença: trocar só o operador a deixaria inválida.
    const res = await update("r3", { operator: "lt" });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([
      { campo: "operator", erro: "presença só aceita o operador eq (igual a)" },
    ]);
  });

  it("recusa patch vazio", async () => {
    const res = await update("r1", {});

    expect(res.status).toBe(400);
    expect(res.body.details[0].erro).toBe("Informe pelo menos um campo para alterar");
  });

  it("responde 404 para rotina que não existe", async () => {
    const res = await update("nao-existe", { enabled: true });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/routines/:id", () => {
  it("remove e responde 204 sem corpo", async () => {
    const res = await remove("r2");

    expect(res.status).toBe(204);
    expect(res.text).toBe("");
    expect((await list()).body.map((routine) => routine.id)).toEqual(["r1", "r3"]);
  });

  it("responde 404 para rotina que não existe", async () => {
    const res = await remove("nao-existe");

    expect(res.status).toBe(404);
  });
});

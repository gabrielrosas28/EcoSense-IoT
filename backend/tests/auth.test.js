import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { pool } from "../src/database/pool.js";
import { DEV_USER } from "../src/database/seed.js";
import { authHeader } from "./support/auth.js";

const app = createApp();

const login = (body) => request(app).post("/api/auth/login").send(body);

describe("POST /api/auth/login", () => {
  it("devolve token e usuário com as credenciais do seed", async () => {
    const res = await login({ email: DEV_USER.email, password: DEV_USER.password });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      name: "Administrador",
      email: "admin@ecosense.local",
    });
  });

  it("nunca devolve a senha nem o hash", async () => {
    const res = await login({ email: DEV_USER.email, password: DEV_USER.password });

    expect(JSON.stringify(res.body)).not.toMatch(/scrypt|password|ecosense123/);
  });

  it("não diferencia maiúsculas no e-mail", async () => {
    const res = await login({ email: "ADMIN@EcoSense.local", password: DEV_USER.password });

    expect(res.status).toBe(200);
  });

  it("recusa senha errada", async () => {
    const res = await login({ email: DEV_USER.email, password: "senha-errada" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "E-mail ou senha inválidos" });
  });

  it("dá a mesma resposta para e-mail que não existe", async () => {
    // Mensagem igual de propósito: não revela quais e-mails estão cadastrados.
    const res = await login({ email: "ninguem@ecosense.local", password: DEV_USER.password });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "E-mail ou senha inválidos" });
  });

  it("valida o corpo no formato que a tela de login lê (details[0].erro)", async () => {
    const res = await login({ email: "nao-e-email", password: "123" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "Dados inválidos",
      details: [
        { campo: "email", erro: "Informe um e-mail válido" },
        { campo: "password", erro: "A senha tem pelo menos 6 caracteres" },
      ],
    });
  });

  it("pede e-mail e senha quando o corpo vem vazio", async () => {
    const res = await login({});

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([
      { campo: "email", erro: "Informe um e-mail válido" },
      { campo: "password", erro: "Informe a senha" },
    ]);
  });
});

describe("POST /api/auth/register", () => {
  const register = (body) => request(app).post("/api/auth/register").send(body);
  const NOVO = { name: "Maria Souza", email: "maria@ecosense.local", password: "senha-forte" };

  it("cadastra e já devolve a sessão, como o login", async () => {
    const res = await register(NOVO);

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      name: "Maria Souza",
      email: "maria@ecosense.local",
    });

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${res.body.token}`);
    expect(me.body).toEqual(res.body.user);
  });

  it("guarda só o hash da senha no banco (RNF03)", async () => {
    await register(NOVO);

    const { rows } = await pool.query("SELECT password_hash FROM users WHERE email = $1", [NOVO.email]);
    expect(rows[0].password_hash).toMatch(/^scrypt\$[^$]+\$[^$]+$/);
    expect(rows[0].password_hash).not.toContain(NOVO.password);
  });

  it("nunca devolve a senha nem o hash", async () => {
    const res = await register(NOVO);

    expect(JSON.stringify(res.body)).not.toMatch(/scrypt|password|senha-forte/);
  });

  it("permite entrar com a senha cadastrada", async () => {
    await register(NOVO);

    const ok = await login({ email: NOVO.email, password: NOVO.password });
    const errada = await login({ email: NOVO.email, password: "outra-senha" });

    expect(ok.status).toBe(200);
    expect(errada.status).toBe(401);
  });

  it("recusa e-mail já cadastrado, sem diferenciar maiúsculas", async () => {
    const res = await register({ ...NOVO, email: "ADMIN@ecosense.local" });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "Este e-mail já está cadastrado" });
  });

  it("aceita só um de dois cadastros simultâneos com o mesmo e-mail", async () => {
    const respostas = await Promise.all([register(NOVO), register(NOVO)]);

    expect(respostas.map((r) => r.status).sort()).toEqual([201, 409]);
  });

  it("valida o corpo no formato que a tela lê (details[0].erro)", async () => {
    const res = await register({ name: " ", email: "nao-e-email", password: "123" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "Dados inválidos",
      details: [
        { campo: "name", erro: "O nome tem pelo menos 2 caracteres" },
        { campo: "email", erro: "Informe um e-mail válido" },
        { campo: "password", erro: "A senha tem pelo menos 6 caracteres" },
      ],
    });
  });

  it("tira os espaços das pontas do nome", async () => {
    const res = await register({ ...NOVO, name: "  Maria Souza  " });

    expect(res.body.user.name).toBe("Maria Souza");
  });
});

describe("GET /api/auth/me", () => {
  it("devolve o usuário do token emitido no login", async () => {
    const { body } = await login({ email: DEV_USER.email, password: DEV_USER.password });

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${body.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(body.user);
  });

  it("recusa requisição sem token", async () => {
    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Faça login para continuar" });
  });

  it("recusa token adulterado", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer nao.e.um-token");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Sessão inválida ou expirada" });
  });

  it("recusa token expirado", async () => {
    const vencido = jwt.sign(
      { email: DEV_USER.email, exp: Math.floor(Date.now() / 1000) - 60 },
      process.env.JWT_SECRET,
    );

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${vencido}`);

    expect(res.status).toBe(401);
  });

  it("recusa sessão de usuário que não existe mais", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", authHeader());

    expect(res.status).toBe(401);
  });
});

describe("rotas protegidas", () => {
  it.each(["/api/devices", "/api/routines", "/api/events"])("%s exige login", async (path) => {
    const res = await request(app).get(path);

    expect(res.status).toBe(401);
  });

  it("aceita o esquema Bearer em minúsculas", async () => {
    const res = await request(app)
      .get("/api/devices")
      .set("Authorization", authHeader().replace("Bearer", "bearer"));

    expect(res.status).toBe(200);
  });
});

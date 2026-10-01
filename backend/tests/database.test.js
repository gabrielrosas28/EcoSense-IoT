import { describe, expect, it } from "vitest";
import { migrate, pendingMigrations } from "../src/database/migrator.js";
import { pool, transaction } from "../src/database/pool.js";
import { seed } from "../src/database/seed.js";

const count = async (table) => (await pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n;

describe("migrations", () => {
  it("não reaplica o que já foi aplicado", async () => {
    expect(await migrate(pool, { log: () => {} })).toEqual([]);
    expect(await pendingMigrations(pool)).toEqual([]);
  });
});

describe("seed", () => {
  it("pode rodar de novo sem duplicar nem sobrescrever o estado atual", async () => {
    await pool.query("UPDATE devices SET is_on = false WHERE id = 'luz'");

    await seed(pool, { log: () => {} });

    expect(await count("devices")).toBe(4);
    expect(await count("routines")).toBe(3);
    expect(await count("events")).toBe(4);
    expect(await count("users")).toBe(1);
    expect((await pool.query("SELECT is_on FROM devices WHERE id = 'luz'")).rows[0].is_on).toBe(false);
  });

  it("guarda a senha só como hash", async () => {
    const { rows } = await pool.query("SELECT password_hash FROM users");

    expect(rows[0].password_hash).toMatch(/^scrypt\$/);
    expect(rows[0].password_hash).not.toContain("ecosense123");
  });
});

describe("transaction", () => {
  it("desfaz tudo se algo falhar no meio", async () => {
    const falha = transaction(async (client) => {
      await client.query("UPDATE devices SET is_on = false WHERE id = 'umidificador'");
      throw new Error("falha no meio");
    });

    await expect(falha).rejects.toThrow("falha no meio");
    expect((await pool.query("SELECT is_on FROM devices WHERE id = 'umidificador'")).rows[0].is_on).toBe(true);
  });
});

describe("restrições do esquema", () => {
  it("recusa modo inválido mesmo fora da API", async () => {
    await expect(pool.query("UPDATE devices SET mode = 'turbo' WHERE id = 'luz'")).rejects.toMatchObject({
      code: "23514",
    });
  });

  it("recusa e-mail repetido, sem diferenciar maiúsculas", async () => {
    await expect(
      pool.query("INSERT INTO users (name, email, password_hash) VALUES ('x', 'ADMIN@ecosense.local', 'x')"),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("atualiza updated_at sozinho", async () => {
    await pool.query("UPDATE devices SET updated_at = '2000-01-01' WHERE id = 'luz'");
    await pool.query("UPDATE devices SET is_on = NOT is_on WHERE id = 'luz'");

    const { rows } = await pool.query("SELECT updated_at FROM devices WHERE id = 'luz'");
    expect(rows[0].updated_at.getFullYear()).toBeGreaterThan(2000);
  });
});

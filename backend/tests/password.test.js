import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/lib/password.js";

describe("hash de senha", () => {
  it("confere a senha certa e recusa a errada", async () => {
    const hash = await hashPassword("ecosense123");

    expect(await verifyPassword("ecosense123", hash)).toBe(true);
    expect(await verifyPassword("ecosense124", hash)).toBe(false);
  });

  it("gera um hash diferente a cada vez (salt aleatório)", async () => {
    expect(await hashPassword("mesma-senha")).not.toBe(await hashPassword("mesma-senha"));
  });

  it("nunca confere hash em formato desconhecido", async () => {
    expect(await verifyPassword("x", "$2b$10$hashDeOutroAlgoritmo")).toBe(false);
    expect(await verifyPassword("x", "scrypt$semhash$")).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
  });
});

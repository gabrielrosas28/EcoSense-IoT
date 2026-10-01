import { randomUUID } from "node:crypto";
import { DEV_USER } from "../../src/database/seed.js";
import { signToken } from "../../src/lib/token.js";

/** Cabeçalho de sessão válido, sem passar pelo login (que tem testes próprios). */
export function authHeader(user = { id: randomUUID(), name: DEV_USER.name, email: DEV_USER.email }) {
  return `Bearer ${signToken(user)}`;
}

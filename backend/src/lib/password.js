import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

/**
 * Hash de senha com scrypt, nativo do Node (sem dependência externa).
 * Formato guardado no banco: `scrypt$<salt em base64>$<hash em base64>`.
 */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

/** Compara em tempo constante. Hash em formato desconhecido nunca confere. */
export async function verifyPassword(password, stored) {
  const [algorithm, salt, hash] = String(stored).split("$");
  if (algorithm !== "scrypt" || !salt || !hash) return false;

  const expected = Buffer.from(hash, "base64");
  const actual = await scryptAsync(password, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

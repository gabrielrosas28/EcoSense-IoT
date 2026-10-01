import { randomUUID } from "node:crypto";
import { HttpError } from "../lib/httpError.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { signToken } from "../lib/token.js";
import * as users from "../repositories/user.repository.js";

// Quando o e-mail não existe, a senha é comparada mesmo assim contra este hash:
// o tempo de resposta não revela quais e-mails estão cadastrados.
let dummyHash;

export async function login(email, password) {
  const user = await users.findByEmail(email);
  dummyHash ??= hashPassword(randomUUID());
  const valid = await verifyPassword(password, user?.passwordHash ?? (await dummyHash));

  if (!user || !valid) throw HttpError.unauthorized("E-mail ou senha inválidos");

  return { token: signToken(user), user: toPublicUser(user) };
}

export async function getProfile(userId) {
  const user = await users.findById(userId);
  if (!user) throw HttpError.unauthorized("O usuário desta sessão não existe mais");
  return toPublicUser(user);
}

function toPublicUser({ id, name, email }) {
  return { id, name, email };
}

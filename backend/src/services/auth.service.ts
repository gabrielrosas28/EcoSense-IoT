import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { User } from "../../generated/prisma/client.ts";
import { env } from "../config/env.ts";
import { prisma } from "../lib/prisma.ts";
import type { UserDTO } from "../types/api.ts";
import { HttpError } from "../utils/HttpError.ts";
import { serializeUser } from "../utils/serializers.ts";

const ROUNDS = 10;

/** Hash "impossível" usado quando o e-mail não existe (ver `login`). */
const HASH_FALSO = "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva";

export const hashPassword = (senha: string): Promise<string> => bcrypt.hash(senha, ROUNDS);

export interface LoginResult {
  token: string;
  user: UserDTO;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { email } });

  // Compara mesmo sem usuário: evita revelar quais e-mails existem pelo tempo
  // de resposta.
  const ok = await bcrypt.compare(password, user?.passwordHash ?? HASH_FALSO);

  if (!user || !ok) throw HttpError.unauthorized("E-mail ou senha inválidos");

  return { token: signToken(user), user: serializeUser(user) };
}

export async function me(userId: string): Promise<UserDTO> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw HttpError.unauthorized("Usuário não existe mais");
  return serializeUser(user);
}

function signToken(user: User): string {
  const options: SignOptions = {
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  };
  return jwt.sign({ email: user.email }, env.JWT_SECRET, options);
}

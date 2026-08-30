import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.ts";
import { env } from "../config/env.ts";

/**
 * Conexão com o Postgres.
 *
 * No Prisma 7 o cliente fala com o banco por um *driver adapter* — aqui o
 * `@prisma/adapter-pg`, que usa o pool do `pg` por baixo. O cliente gerado
 * fica em `generated/prisma` (não versionado; rode `npm run prisma:generate`).
 */
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({
  adapter,
  log: env.isDev ? ["warn", "error"] : ["error"],
});

/** Verifica no boot se o banco responde — falhar cedo é melhor que falhar tarde. */
export async function connectDatabase(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

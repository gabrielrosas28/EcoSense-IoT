// Configuração da CLI do Prisma 7. Carrega o .env (o Prisma não faz isso sozinho).
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Roda depois de `prisma migrate reset` / `prisma db seed`.
    seed: "node --env-file=.env prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});

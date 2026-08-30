/**
 * Ambiente dos testes.
 *
 * `src/config/env.ts` valida as variáveis no import e mata o processo se
 * faltar alguma — então elas precisam existir ANTES de qualquer import da
 * aplicação. Por isso este arquivo é `setupFiles` no vitest.config.ts.
 *
 * A DATABASE_URL aqui nunca é usada de verdade: os testes mockam o Prisma
 * (ver `tests/helpers/prismaMock.ts`), então nenhum banco precisa estar de pé.
 */
process.env["NODE_ENV"] = "test";
process.env["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test?schema=public";
process.env["JWT_SECRET"] = "segredo-de-teste-com-tamanho-suficiente";
process.env["JWT_EXPIRES_IN"] = "1h";
process.env["CORS_ORIGIN"] = "*";
process.env["PORT"] = "3001"; // nao e usado: os testes falam com o app em memoria

import { vi } from "vitest";

/**
 * Dublê do `src/lib/prisma.ts`.
 *
 * Os testes de integração exercitam rota → middleware → controller → service
 * de verdade; só o acesso ao banco é substituído. Assim a suíte roda em
 * qualquer máquina, sem Postgres, e continua cobrindo validação, serialização
 * e tratamento de erro.
 *
 * Uso (o `vi.mock` é içado para o topo do arquivo, por isso vai em cada teste):
 *
 *   vi.mock("../../src/lib/prisma.ts", () => import("../helpers/prismaMock.ts"));
 */

const model = () => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  createMany: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
  count: vi.fn(),
});

export const prisma = {
  user: model(),
  environment: model(),
  device: model(),
  reading: model(),
  event: model(),
  command: model(),
  routine: model(),

  // `service.sendCommand` usa transação interativa: o callback recebe o
  // próprio mock, então as asserções valem para as chamadas de dentro.
  $transaction: vi.fn(async (fn: (tx: typeof prisma) => unknown) => fn(prisma)),
  $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
  $disconnect: vi.fn().mockResolvedValue(undefined),
};

export const connectDatabase = vi.fn().mockResolvedValue(undefined);
export const disconnectDatabase = vi.fn().mockResolvedValue(undefined);

/** Zera as chamadas e recoloca os defaults entre testes. */
export function resetPrismaMock(): void {
  for (const key of Object.keys(prisma) as (keyof typeof prisma)[]) {
    const valor = prisma[key];
    if (typeof valor === "function") {
      vi.mocked(valor).mockClear();
      continue;
    }
    for (const metodo of Object.values(valor)) vi.mocked(metodo).mockReset();
  }
  prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
  prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
}

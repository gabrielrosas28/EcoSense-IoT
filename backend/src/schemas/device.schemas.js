import { z } from "../lib/zod.js";

export const deviceParams = z.object({ id: z.string().max(40) });

/** Janelas de agregação aceitas em `?interval=` (rótulo → intervalo do Postgres). */
export const READING_INTERVALS = {
  "1m": "1 minute",
  "5m": "5 minutes",
  "15m": "15 minutes",
  "1h": "1 hour",
  "1d": "1 day",
};

const instant = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

/**
 * Histórico de leituras. Sem `from`/`to`, as últimas 24 h. Sem `sensor`, todos
 * os sensores do dispositivo. Sem `interval`, as amostras cruas; com ele, uma
 * média por janela (o que o gráfico quer para períodos longos).
 */
export const readingsQuery = z
  .object({
    sensor: z.string().min(1).max(40).optional(),
    from: instant.optional(),
    to: instant.optional(),
    interval: z.enum(Object.keys(READING_INTERVALS)).optional(),
    limit: z.coerce.number().int().min(1).max(1000).default(500),
  })
  .transform(({ from, to = new Date(), ...rest }) => ({
    ...rest,
    to,
    from: from ?? new Date(to.getTime() - 24 * 60 * 60 * 1000),
  }))
  .refine(({ from, to }) => from < to, { path: ["from"], message: "deve ser anterior a to" });

const scalar = z.union([z.string().max(100), z.number(), z.boolean()]);

/**
 * Comandos do painel, no formato que `api.sendCommand` envia (frontend) e que
 * o simulador/ESP32 recebe em `ecosense/<id>/cmd`. O que cada dispositivo
 * aceita de fato é conferido no service, com o catálogo de `domain/devices.js`.
 */
export const commandBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("power"), value: z.union([z.enum(["on", "off"]), z.boolean()]) }),
  z.object({ action: z.literal("mode"), value: z.enum(["auto", "manual"]) }),
  z.object({ action: z.literal("threshold"), key: z.string().min(1), value: z.number() }),
  z.object({ action: z.literal("config") }).catchall(scalar),
  z.object({ action: z.literal("ir"), key: z.string().min(1).max(40) }),
]);

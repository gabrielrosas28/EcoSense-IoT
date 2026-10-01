import { z } from "../lib/zod.js";

export const deviceParams = z.object({ id: z.string().max(40) });

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

import { z } from "zod";
import { DEVICE_SLUGS } from "../types/api.ts";

export const slugParam = z.object({
  slug: z.enum(DEVICE_SLUGS),
});

export const idParam = z.object({ id: z.uuid("id deve ser um UUID") });

/** Comando do painel — o `action` decide os campos extras (ver device.service). */
export const commandBody = z
  .object({
    action: z.string().min(1),
    key: z.string().optional(),
    value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  })
  .loose();

/** Status vindo do device/simulador (espelha o payload MQTT). */
export const statusBody = z
  .object({
    on: z.boolean().optional(),
    mode: z.enum(["auto", "manual"]).optional(),
    online: z.boolean().optional(),
  })
  .loose();

export const historyQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(40),
});

const OPERADORES = ["<", "<=", ">", ">=", "==", "!="] as const;

export const routineBody = z.object({
  name: z.string().min(1).max(120).optional(),
  enabled: z.boolean().optional(),
  sensor: z.string().min(1),
  operator: z.enum(OPERADORES),
  value: z.number(),
  action: z.enum(["ligar", "desligar"]),
  device: z.enum(DEVICE_SLUGS),
});

export const routinePatchBody = routineBody.partial();

export const loginBody = z.object({
  email: z.email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
});

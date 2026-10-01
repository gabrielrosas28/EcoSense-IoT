import { ROUTINE_ACTIONS, ROUTINE_OPERATORS, ROUTINE_SENSORS } from "../domain/routines.js";
import { z } from "../lib/zod.js";

export const routineParams = z.object({ id: z.string().max(64) });

const fields = {
  sensor: z.enum(ROUTINE_SENSORS),
  operator: z.enum(ROUTINE_OPERATORS),
  value: z.number(),
  action: z.enum(ROUTINE_ACTIONS),
  device: z.string().min(1).max(40),
  enabled: z.boolean(),
};

/**
 * Mesmo formato do store do frontend (store/useRoutines.js). O `id` é opcional:
 * o frontend manda o que gerou na tela; sem ele, a API gera um UUID.
 */
export const createRoutineBody = z.object({
  id: z
    .string()
    .regex(/^[\w-]{1,64}$/, "use até 64 caracteres entre letras, números, - e _")
    .optional(),
  ...fields,
  enabled: fields.enabled.default(true),
});

export const updateRoutineBody = z
  .object(fields)
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, "Informe pelo menos um campo para alterar");

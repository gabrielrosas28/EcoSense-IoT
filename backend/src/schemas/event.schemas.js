import { z } from "../lib/zod.js";

export const eventsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  device: z.string().max(40).optional(),
});

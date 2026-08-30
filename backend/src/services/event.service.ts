import type { EventSource } from "../../generated/prisma/enums.ts";
import { prisma } from "../lib/prisma.ts";
import type { EventDTO } from "../types/api.ts";
import { serializeEvent } from "../utils/serializers.ts";

export async function record(
  deviceId: string | null,
  message: string,
  source: EventSource = "SYSTEM",
): Promise<void> {
  await prisma.event.create({ data: { deviceId, message, source } });
}

export async function list({ limit = 40 }: { limit?: number } = {}): Promise<EventDTO[]> {
  const events = await prisma.event.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { device: { select: { slug: true } } },
  });
  return events.map(serializeEvent);
}

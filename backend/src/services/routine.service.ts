import type { Prisma } from "../../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";
import type { RoutineDTO } from "../types/api.ts";
import { HttpError } from "../utils/HttpError.ts";
import { serializeRoutine } from "../utils/serializers.ts";
import { getBySlug } from "./device.service.ts";

const include = { device: { select: { slug: true } } } satisfies Prisma.RoutineInclude;

export interface RoutineInput {
  name?: string;
  enabled?: boolean;
  sensor: string;
  operator: string;
  value: number;
  action: string;
  device: string;
}

export type RoutinePatch = Partial<RoutineInput>;

export async function list(): Promise<RoutineDTO[]> {
  const routines = await prisma.routine.findMany({ orderBy: { createdAt: "desc" }, include });
  return routines.map(serializeRoutine);
}

export async function create(
  input: RoutineInput,
  ownerId: string | null = null,
): Promise<RoutineDTO> {
  const device = await getBySlug(input.device);

  const routine = await prisma.routine.create({
    data: {
      name: input.name ?? descrever(input, device.name),
      enabled: input.enabled ?? true,
      sensor: input.sensor,
      operator: input.operator,
      value: input.value,
      action: input.action,
      deviceId: device.id,
      ownerId,
    },
    include,
  });

  return serializeRoutine(routine);
}

export async function update(id: string, patch: RoutinePatch): Promise<RoutineDTO> {
  const data: Prisma.RoutineUpdateInput = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.enabled !== undefined) data.enabled = patch.enabled;
  if (patch.sensor !== undefined) data.sensor = patch.sensor;
  if (patch.operator !== undefined) data.operator = patch.operator;
  if (patch.value !== undefined) data.value = patch.value;
  if (patch.action !== undefined) data.action = patch.action;
  if (patch.device !== undefined) {
    data.device = { connect: { id: (await getBySlug(patch.device)).id } };
  }

  if (Object.keys(data).length === 0) {
    throw HttpError.badRequest("Nada para atualizar");
  }

  const routine = await prisma.routine.update({ where: { id }, data, include });
  return serializeRoutine(routine);
}

export async function remove(id: string): Promise<void> {
  await prisma.routine.delete({ where: { id } });
}

/** "Se soil < 30 então ligar Irrigação" */
function descrever(input: RoutineInput, deviceName: string): string {
  return `Se ${input.sensor} ${input.operator} ${input.value} então ${input.action} ${deviceName}`;
}

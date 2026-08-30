import type {
  Command,
  Device,
  Environment,
  Event,
  Reading,
  Routine,
  User,
} from "../../generated/prisma/client.ts";
import type {
  DeviceDTO,
  DeviceReading,
  EnvironmentDTO,
  EventDTO,
  ReadingDTO,
  RoutineDTO,
  UserDTO,
} from "../types/api.ts";

/**
 * Traduz as entidades do banco para o formato que o frontend já usa
 * (`store/useDevices.js`). O contrato da API é o do store — o banco é detalhe
 * interno, e mudanças de schema não devem vazar para a UI.
 */

export function serializeDevice(
  device: Device & { environment?: Environment | null },
): DeviceDTO {
  return {
    id: device.slug,
    name: device.name,
    accent: device.accent,
    on: device.isOn,
    mode: device.mode === "AUTO" ? "auto" : "manual",
    online: device.online,
    reading: (device.settings ?? {}) as DeviceReading,
    lastSeen: device.lastSeen,
    // `id` é o slug, como no dispositivo: o UUID não sai da API.
    environment: device.environment
      ? { id: device.environment.slug, name: device.environment.name }
      : null,
  };
}

export function serializeEnvironment(environment: Environment): EnvironmentDTO {
  return {
    id: environment.slug,
    name: environment.name,
    description: environment.description,
    location: environment.location,
  };
}

export function serializeReading(
  reading: Reading & { device?: { slug: string } | null },
): ReadingDTO {
  return {
    id: reading.id,
    device: reading.device?.slug ?? reading.deviceId,
    metric: reading.metric,
    value: reading.value,
    unit: reading.unit,
    at: reading.readAt,
  };
}

export function serializeEvent(
  event: Event & { device?: { slug: string } | null },
): EventDTO {
  return {
    id: event.id,
    device: event.device?.slug ?? null,
    text: event.message,
    at: event.createdAt,
    source: event.source,
  };
}

export function serializeRoutine(
  routine: Routine & { device?: { slug: string } | null },
): RoutineDTO {
  return {
    id: routine.id,
    name: routine.name,
    enabled: routine.enabled,
    if: {
      sensor: routine.sensor,
      operator: routine.operator,
      value: routine.value,
    },
    then: {
      action: routine.action,
      device: routine.device?.slug ?? routine.deviceId,
    },
    createdAt: routine.createdAt,
  };
}

export function serializeUser(user: User): UserDTO {
  return { id: user.id, email: user.email, name: user.name };
}

export type { Command, Device, Environment, Event, Reading, Routine, User };

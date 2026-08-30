import type { Prisma } from "../../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";
import { DEVICE_SLUGS, type DeviceCommand, type DeviceDTO, type DeviceStatus } from "../types/api.ts";
import { HttpError } from "../utils/HttpError.ts";
import { serializeDevice } from "../utils/serializers.ts";
import { publishCommand } from "./deviceBus.ts";
import * as events from "./event.service.ts";

/** Ordem fixa das telas (igual ao DEVICE_ORDER do frontend). */
const ORDER: readonly string[] = DEVICE_SLUGS;

/** Sempre traz o ambiente junto: o DTO do dispositivo expõe onde ele está. */
const include = { environment: true } satisfies Prisma.DeviceInclude;

/** Dispositivo com o ambiente carregado — o que os services manipulam. */
type DeviceComAmbiente = Prisma.DeviceGetPayload<{ include: typeof include }>;

/**
 * O que conta como leitura de sensor — e em que unidade.
 *
 * O payload de status mistura medição com configuração: `soil` é sensor,
 * `threshold` é ajuste do usuário. Só o que está neste mapa vira linha na série
 * temporal (`readings`); o resto fica apenas em `Device.settings`.
 */
const SENSOR_METRICS: Record<string, string | null> = {
  soil: "%",
  air: "%",
  temperatura: "°C",
  luminosidade: "lux",
  consumo: "W",
  presenca: null,
};

export async function list(): Promise<DeviceDTO[]> {
  const devices = await prisma.device.findMany({ include });
  const bySlug = new Map(devices.map((d) => [d.slug, d]));
  const ordenados = [
    ...ORDER.map((slug) => bySlug.get(slug)).filter((d): d is DeviceComAmbiente => Boolean(d)),
    ...devices.filter((d) => !ORDER.includes(d.slug)),
  ];
  return ordenados.map(serializeDevice);
}

export async function getBySlug(slug: string): Promise<DeviceComAmbiente> {
  const device = await prisma.device.findUnique({ where: { slug }, include });
  if (!device) throw HttpError.notFound(`Dispositivo "${slug}" não existe`);
  return device;
}

export async function show(slug: string): Promise<DeviceDTO> {
  return serializeDevice(await getBySlug(slug));
}

export interface CommandResult {
  device: DeviceDTO;
  topic: string;
}

/**
 * Aplica um comando do painel: grava o novo estado, registra no histórico e
 * publica no barramento (MQTT, na fase 2).
 *
 * `command` segue o que o store manda em `api.sendCommand`:
 *   { action: "power",     value: "on" | "off" }
 *   { action: "mode",      value: "auto" | "manual" }
 *   { action: "threshold", key: "threshold", value: 30 }
 *   { action: "config",    ...patch }            // resto vira patch em settings
 */
export async function sendCommand(
  slug: string,
  command: DeviceCommand,
): Promise<CommandResult> {
  const device = await getBySlug(slug);
  const { patch, mensagem } = interpret(device, command);

  const atualizado = await prisma.$transaction(async (tx) => {
    const updated = await tx.device.update({
      where: { id: device.id },
      data: patch,
      include,
    });
    await tx.command.create({
      data: {
        deviceId: device.id,
        action: command.action,
        payload: command as Prisma.InputJsonValue,
        status: "SENT",
      },
    });
    return updated;
  });

  await events.record(device.id, mensagem, "USER");
  const bus = await publishCommand(slug, command);

  return { device: serializeDevice(atualizado), topic: bus.topic };
}

interface Interpretation {
  patch: Prisma.DeviceUpdateInput;
  mensagem: string;
}

/** Traduz o comando do frontend em patch de banco + texto para o histórico. */
function interpret(device: DeviceComAmbiente, command: DeviceCommand): Interpretation {
  const settings = (device.settings ?? {}) as Record<string, unknown>;

  switch (command.action) {
    case "power": {
      const on = command.value === "on" || command.value === true;
      return {
        patch: { isOn: on },
        mensagem: `${device.name} ${on ? "ligado" : "desligado"} pelo painel`,
      };
    }

    case "mode": {
      const mode = command.value === "auto" ? "AUTO" : "MANUAL";
      return {
        patch: { mode },
        mensagem: `${device.name} em modo ${mode === "AUTO" ? "automático" : "manual"}`,
      };
    }

    case "threshold": {
      if (!command.key) throw HttpError.badRequest("Comando threshold exige `key`");
      return {
        patch: {
          settings: { ...settings, [command.key]: command.value } as Prisma.InputJsonValue,
        },
        mensagem: `${device.name}: ${command.key} ajustado para ${String(command.value)}`,
      };
    }

    case "config": {
      const { action: _action, ...patch } = command;
      return {
        patch: { settings: { ...settings, ...patch } as Prisma.InputJsonValue },
        mensagem: `${device.name}: configuração atualizada`,
      };
    }

    // Comandos sem estado no banco (IR do projetor: d-pad, menu, volume).
    default: {
      return {
        patch: {},
        mensagem: `${device.name}: comando "${command.action}" enviado`,
      };
    }
  }
}

/**
 * Estado vindo do hardware (`ecosense/<slug>/status`). Só grava — nunca
 * republica comando, senão vira laço entre backend e device.
 */
export async function applyIncomingStatus(
  slug: string,
  payload: DeviceStatus = {},
): Promise<DeviceDTO> {
  const device = await getBySlug(slug);
  const { on, mode, online, ...reading } = payload;

  const data: Prisma.DeviceUpdateInput = { lastSeen: new Date() };
  if (typeof on === "boolean") data.isOn = on;
  if (mode === "auto" || mode === "manual") data.mode = mode === "auto" ? "AUTO" : "MANUAL";
  if (typeof online === "boolean") data.online = online;
  if (Object.keys(reading).length) {
    const settings = (device.settings ?? {}) as Record<string, unknown>;
    data.settings = { ...settings, ...reading } as Prisma.InputJsonValue;
  }

  const atualizado = await prisma.device.update({
    where: { id: device.id },
    data,
    include,
  });

  await recordReadings(device, reading);

  return serializeDevice(atualizado);
}

/**
 * Guarda as medições na série temporal (`readings`).
 *
 * O `environmentId` é copiado do dispositivo no momento da leitura: se o device
 * for realocado depois, o histórico continua dizendo onde aquilo foi medido.
 * Booleano vira 1/0 — `presenca` é sensor, e um gráfico precisa de número.
 */
async function recordReadings(
  device: DeviceComAmbiente,
  payload: Record<string, unknown>,
): Promise<void> {
  const linhas = Object.entries(payload)
    .filter(([metric]) => metric in SENSOR_METRICS)
    .map(([metric, valor]) => ({
      deviceId: device.id,
      environmentId: device.environmentId,
      metric,
      value: typeof valor === "boolean" ? (valor ? 1 : 0) : Number(valor),
      unit: SENSOR_METRICS[metric] ?? null,
    }))
    .filter((linha) => Number.isFinite(linha.value));

  if (linhas.length) await prisma.reading.createMany({ data: linhas });
}

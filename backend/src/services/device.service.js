import { transaction } from "../database/pool.js";
import { DEVICE_CATALOG, IR_KEYS } from "../domain/devices.js";
import { publishCommand } from "../lib/deviceBus.js";
import { HttpError } from "../lib/httpError.js";
import { toDetails, z } from "../lib/zod.js";
import * as devices from "../repositories/device.repository.js";
import * as events from "../repositories/event.repository.js";
import * as readings from "../repositories/reading.repository.js";

const NO_CATALOG = { settings: {}, sensors: {} };

export function listDevices() {
  return devices.findAll();
}

export async function getDevice(id) {
  const device = await devices.findById(id);
  if (!device) throw HttpError.notFound(`Dispositivo "${id}" não existe`);
  return device;
}

export async function sendCommand(id, command, { source = "user", via = "pelo painel" } = {}) {
  const current = await getDevice(id);
  const { patch, event } = interpret(current, command, via);

  let device = current;
  if (patch || event) {
    device = await transaction(async (client) => {
      const updated = patch ? await devices.updateState(id, patch, client) : current;
      if (event) await events.create({ deviceId: id, message: event, source }, client);
      return updated;
    });
  }

  const { topic } = publishCommand(id, command);
  return { device, topic };
}

export async function applyStatus(id, payload) {
  const { patch, samples, ignored } = readStatus(id, payload);

  return transaction(async (client) => {
    const before = await devices.findForUpdate(id, client);
    if (!before) return null;

    const after = await devices.updateState(id, patch, client);
    await readings.createMany(id, samples, client);
    for (const message of statusEvents(before, after)) {
      await events.create({ deviceId: id, message, source: "device" }, client);
    }
    return { device: after, previous: before, ignored };
  });
}

const STATE_FIELDS = {
  on: z.boolean(),
  mode: z.enum(["auto", "manual"]),
  online: z.boolean(),
};

function readStatus(id, payload) {
  const catalog = DEVICE_CATALOG[id] ?? NO_CATALOG;
  const readingFields = { ...catalog.settings, ...catalog.sensors };
  const patch = {};
  const reading = {};
  const samples = {};
  const ignored = [];

  for (const [key, value] of Object.entries(payload)) {
    const schema = STATE_FIELDS[key] ?? readingFields[key];
    if (!schema?.safeParse(value).success) {
      ignored.push(key);
    } else if (key in STATE_FIELDS) {
      patch[key] = value;
    } else {
      reading[key] = value;
      if (key in catalog.sensors) samples[key] = Number(value);
    }
  }

  patch.online ??= true;
  patch.seen = patch.online;
  if (Object.keys(reading).length > 0) patch.reading = reading;

  return { patch, samples, ignored };
}

function statusEvents(before, after) {
  const catalog = DEVICE_CATALOG[after.id] ?? NO_CATALOG;
  const messages = [];
  if (before.online !== after.online) {
    messages.push(after.online ? `${after.name} voltou a ficar online` : `${after.name} ficou offline`);
  }
  if (before.on !== after.on) {
    messages.push(`${after.name} ${stateWord(after.on, catalog)} pelo dispositivo`);
  }
  return messages;
}

function interpret(device, command, via) {
  const catalog = DEVICE_CATALOG[device.id] ?? NO_CATALOG;

  switch (command.action) {
    case "power": {
      const on = command.value === true || command.value === "on";
      return { patch: { on }, event: `${device.name} ${stateWord(on, catalog)} ${via}` };
    }

    case "mode": {
      const label = command.value === "auto" ? "automático" : "manual";
      return { patch: { mode: command.value }, event: `${device.name} em modo ${label}` };
    }

    case "threshold":
      return { patch: { reading: checkSettings(device, catalog, { [command.key]: command.value }) } };

    case "config": {
      const { action: _action, ...settings } = command;
      return { patch: { reading: checkSettings(device, catalog, settings) } };
    }

    case "ir":
      return interpretInfrared(device, catalog, command.key);

    default:
      throw HttpError.badRequest(`Ação desconhecida: "${command.action}"`);
  }
}

function interpretInfrared(device, catalog, key) {
  if (!catalog.infrared) {
    throw HttpError.badRequest(`${device.name} não tem controle por infravermelho`);
  }
  if (key.startsWith("source:")) {
    const fonte = key.slice("source:".length);
    return { patch: { reading: checkSettings(device, catalog, { fonte }) } };
  }
  if (!IR_KEYS.includes(key)) {
    throw HttpError.badRequest("Tecla IR desconhecida", [
      { campo: "key", erro: `use source:<fonte> ou uma destas: ${IR_KEYS.join(", ")}` },
    ]);
  }
  return {};
}

function checkSettings(device, catalog, settings) {
  if (Object.keys(settings).length === 0) {
    throw HttpError.badRequest("Nenhum ajuste informado");
  }
  const result = z.strictObject(catalog.settings).partial().safeParse(settings);
  if (!result.success) {
    throw HttpError.badRequest(`Ajuste inválido para ${device.name}`, toDetails(result.error));
  }
  return result.data;
}

function stateWord(on, catalog) {
  return (on ? "ligad" : "desligad") + (catalog.feminine ? "a" : "o");
}

import { transaction } from "../database/pool.js";
import { DEVICE_CATALOG, IR_KEYS } from "../domain/devices.js";
import { publishCommand } from "../lib/deviceBus.js";
import { HttpError } from "../lib/httpError.js";
import { toDetails, z } from "../lib/zod.js";
import * as devices from "../repositories/device.repository.js";
import * as events from "../repositories/event.repository.js";

const NO_CATALOG = { settings: {}, sensors: {} };

export function listDevices() {
  return devices.findAll();
}

export async function getDevice(id) {
  const device = await devices.findById(id);
  if (!device) throw HttpError.notFound(`Dispositivo "${id}" não existe`);
  return device;
}

/**
 * Comando do painel: confere se o dispositivo aceita, grava o novo estado,
 * registra no histórico e entrega ao barramento, que publica no MQTT.
 *
 * O estado gravado é o pedido pelo painel. O status que o dispositivo publica
 * de volta (`applyStatus`) é a confirmação e corrige o banco se ele recusar.
 */
export async function sendCommand(id, command) {
  const current = await getDevice(id);
  const { patch, event } = interpret(current, command);

  let device = current;
  if (patch || event) {
    device = await transaction(async (client) => {
      const updated = patch ? await devices.updateState(id, patch, client) : current;
      if (event) await events.create({ deviceId: id, message: event, source: "user" }, client);
      return updated;
    });
  }

  const { topic } = publishCommand(id, command);
  return { device, topic };
}

/**
 * Status publicado pelo dispositivo em `ecosense/<id>/status`: é a verdade
 * sobre o hardware. Grava o estado e registra no histórico o que mudou sem
 * passar pelo painel (ligou ou desligou sozinho, caiu, voltou). Nunca publica
 * comando de volta, senão backend e dispositivo entram em laço.
 *
 * Campo desconhecido ou inválido é ignorado sem descartar o resto: um sensor
 * com defeito não pode esconder o estado dos outros.
 *
 * @returns {Promise<{ device: object, ignored: string[] } | null>} `null` se o
 *   dispositivo não existe
 */
export async function applyStatus(id, payload) {
  const { patch, ignored } = readStatus(id, payload);

  const device = await transaction(async (client) => {
    const before = await devices.findForUpdate(id, client);
    if (!before) return null;

    const after = await devices.updateState(id, patch, client);
    for (const message of statusEvents(before, after)) {
      await events.create({ deviceId: id, message, source: "device" }, client);
    }
    return after;
  });

  return device && { device, ignored };
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
  const ignored = [];

  for (const [key, value] of Object.entries(payload)) {
    const schema = STATE_FIELDS[key] ?? readingFields[key];
    if (!schema?.safeParse(value).success) {
      ignored.push(key);
    } else if (key in STATE_FIELDS) {
      patch[key] = value;
    } else {
      reading[key] = value;
    }
  }

  // Qualquer mensagem prova que o dispositivo está vivo, menos o Last Will
  // que o broker publica quando a conexão cai: `{ "online": false }`.
  patch.online ??= true;
  patch.seen = patch.online;
  if (Object.keys(reading).length > 0) patch.reading = reading;

  return { patch, ignored };
}

/** Mudanças que o dashboard precisa contar. Heartbeat sem mudança não gera nada. */
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

/**
 * Traduz o comando em patch de estado e, quando muda algo visível no
 * dashboard (liga/desliga e modo), em texto para o histórico. Ajustes de
 * slider não viram evento: um arraste geraria dezenas deles.
 */
function interpret(device, command) {
  const catalog = DEVICE_CATALOG[device.id] ?? NO_CATALOG;

  switch (command.action) {
    case "power": {
      const on = command.value === true || command.value === "on";
      return { patch: { on }, event: `${device.name} ${stateWord(on, catalog)} pelo painel` };
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

/** Projetor: `source:<fonte>` troca a fonte; as demais teclas só são repassadas. */
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

/** Só aceita chaves que o painel pode ajustar, nos limites de cada uma. */
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

/** "ligada"/"desligado"... com a concordância do nome do dispositivo. */
function stateWord(on, catalog) {
  return (on ? "ligad" : "desligad") + (catalog.feminine ? "a" : "o");
}

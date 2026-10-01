import { transaction } from "../database/pool.js";
import { DEVICE_CATALOG, IR_KEYS } from "../domain/devices.js";
import { publishCommand } from "../lib/deviceBus.js";
import { HttpError } from "../lib/httpError.js";
import { toDetails, z } from "../lib/zod.js";
import * as devices from "../repositories/device.repository.js";
import * as events from "../repositories/event.repository.js";

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
 * registra no histórico e entrega ao barramento (MQTT na próxima etapa).
 *
 * O estado gravado é o pedido pelo painel; quando o MQTT entrar, o status que
 * o dispositivo publicar de volta passa a ser a confirmação.
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
 * Traduz o comando em patch de estado e, quando muda algo visível no
 * dashboard (liga/desliga e modo), em texto para o histórico. Ajustes de
 * slider não viram evento: um arraste geraria dezenas deles.
 */
function interpret(device, command) {
  const catalog = DEVICE_CATALOG[device.id] ?? { settings: {} };

  switch (command.action) {
    case "power": {
      const on = command.value === true || command.value === "on";
      const state = (on ? "ligad" : "desligad") + (catalog.feminine ? "a" : "o");
      return { patch: { on }, event: `${device.name} ${state} pelo painel` };
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

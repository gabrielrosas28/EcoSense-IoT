import { config } from "../config/env.js";
import { DEVICE_CATALOG } from "../domain/devices.js";
import { conditionHolds, describeCondition } from "../domain/routines.js";
import * as routines from "../repositories/routine.repository.js";
import * as deviceService from "./device.service.js";

/**
 * Motor das rotinas SE → ENTÃO (tela Rotinas do frontend), rodando no backend
 * sobre os status que chegam pelo MQTT, do simulador ou do ESP32.
 *
 * As automações de cada aparelho (luz por presença + sleep, bomba abaixo do
 * limite, umidificador abaixo do limite) rodam no próprio dispositivo, que
 * continua funcionando se a rede cair (RNF04). As rotinas são as regras que o
 * usuário cria por cima, e podem cruzar dispositivos: "SE presença não
 * detectada ENTÃO desligar projetor".
 *
 * Uma rotina dispara na BORDA: quando a condição passa de falsa a verdadeira.
 * Heartbeat repetido não dispara de novo, e a rotina não briga com quem ligou
 * algo na mão depois dela. Ela também não age quando o dispositivo alvo:
 * - está em modo manual (é o override do usuário);
 * - está offline (o comando se perderia);
 * - já está no estado pedido (evita comando à toa e laço com o dispositivo).
 */

/**
 * Chamado pela ponte MQTT depois de gravar um status. Avalia as rotinas dos
 * sensores desse dispositivo com o valor de antes e o de agora.
 *
 * @returns {Promise<object[]>} as rotinas que dispararam e o que aconteceu
 */
export async function afterStatus({ device, previous }) {
  const sensors = Object.keys(DEVICE_CATALOG[device.id]?.sensors ?? {});
  if (sensors.length === 0) return [];

  const candidates = (await routines.findAll()).filter(
    (routine) => routine.enabled && sensors.includes(routine.sensor),
  );
  return runAll(candidates, (routine) => [
    previous.reading[routine.sensor],
    device.reading[routine.sensor],
  ]);
}

/**
 * Rotinas de horário: chamado pelo relógio (`createAutomationClock`) quando a
 * hora local muda, com a hora anterior e a nova.
 */
export async function afterHourChange(previousHour, hour) {
  const candidates = (await routines.findAll()).filter((routine) => routine.enabled && routine.sensor === "hora");
  return runAll(candidates, () => [previousHour, hour]);
}

async function runAll(candidates, valuesOf) {
  const results = [];
  // Uma de cada vez: duas rotinas no mesmo dispositivo leem o estado já atualizado.
  for (const routine of candidates) {
    const [before, now] = valuesOf(routine);
    if (conditionHolds(routine, before) || !conditionHolds(routine, now)) continue;
    results.push(await run(routine));
  }
  return results;
}

async function run(routine) {
  const target = await deviceService.getDevice(routine.device).catch(() => null);
  const on = routine.action === "on";

  let skipped = null;
  if (!target) skipped = "dispositivo não existe";
  else if (!target.online) skipped = "dispositivo offline";
  else if (target.mode === "manual") skipped = "dispositivo em modo manual";
  else if (target.on === on) skipped = on ? "já estava ligado" : "já estava desligado";

  if (skipped) return { routine: routine.id, fired: false, reason: skipped };

  await deviceService.sendCommand(
    routine.device,
    { action: "power", value: routine.action },
    { source: "routine", via: `pela rotina "${describeCondition(routine)}"` },
  );
  return { routine: routine.id, fired: true };
}

const HOUR_FORMAT = new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: config.timezone });

/** Hora local da escola (0 a 23). */
export function localHour(date) {
  return Number(HOUR_FORMAT.format(date));
}

/**
 * Relógio das rotinas de horário: confere a hora a cada `intervalMs` e, quando
 * ela vira, chama `afterHourChange`. Ao subir não dispara nada, porque não
 * sabe a hora "de antes"; a primeira virada já conta.
 */
export function createAutomationClock({ intervalMs = 60_000, now = () => new Date(), log = console } = {}) {
  let timer = null;
  let lastHour = null;
  let running = Promise.resolve();

  function check() {
    const hour = localHour(now());
    const previous = lastHour;
    lastHour = hour;
    if (previous === null || previous === hour) return running;
    running = running
      .then(() => afterHourChange(previous, hour))
      .then((results) => logResults(log, results))
      .catch((err) => log.error("[automação] erro nas rotinas de horário:", err));
    return running;
  }

  return {
    start() {
      check();
      timer = setInterval(check, intervalMs);
      timer.unref?.();
    },
    /** Uma conferência manual (usada nos testes). */
    check,
    async stop() {
      clearInterval(timer);
      await running;
    },
  };
}

/** Registra no log o que cada rotina fez; não dispara nada. */
export function logResults(log, results) {
  for (const result of results) {
    if (result.fired) log.info(`[automação] rotina ${result.routine} disparou`);
    else log.info(`[automação] rotina ${result.routine} não agiu: ${result.reason}`);
  }
}

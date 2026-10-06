import { config } from "../config/env.js";
import { DEVICE_CATALOG } from "../domain/devices.js";
import { conditionReached, describeCondition } from "../domain/routines.js";
import * as routines from "../repositories/routine.repository.js";
import * as deviceService from "./device.service.js";

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

export async function afterHourChange(previousHour, hour) {
  const candidates = (await routines.findAll()).filter((routine) => routine.enabled && routine.sensor === "hora");
  return runAll(candidates, () => [previousHour, hour]);
}

async function runAll(candidates, valuesOf) {
  const results = [];
  for (const routine of candidates) {
    const [before, now] = valuesOf(routine);
    if (!conditionReached(routine, before, now)) continue;
    try {
      results.push(await run(routine));
    } catch (error) {
      results.push({ routine: routine.id, fired: false, reason: `erro: ${error.message}`, error });
    }
  }
  return results;
}

async function run(routine) {
  const target = await deviceService.getDevice(routine.device).catch((err) => {
    if (err.status === 404) return null;
    throw err;
  });
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

export function localHour(date) {
  return Number(HOUR_FORMAT.format(date));
}

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
    check,
    async stop() {
      clearInterval(timer);
      await running;
    },
  };
}

export function logResults(log, results) {
  for (const result of results) {
    if (result.error) log.error(`[automação] rotina ${result.routine} falhou:`, result.error);
    else if (result.fired) log.info(`[automação] rotina ${result.routine} disparou`);
    else log.info(`[automação] rotina ${result.routine} não agiu: ${result.reason}`);
  }
}

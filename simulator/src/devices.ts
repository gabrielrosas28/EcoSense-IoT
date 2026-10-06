import type { DeviceCommand, DeviceSlug, DeviceStatus, Mode } from "./contract.ts";

export type Rng = () => number;

export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PRESENCA_MEDIA_CHEGADA_S = 4 * 60;
const PRESENCA_MEDIA_SAIDA_S = 8 * 60;

const SOLO_SECAGEM_POR_S = 0.02;
const SOLO_BOMBA_POR_S = 1.5;

const AR_AMBIENTE = 50;
const AR_RETORNO_POR_S = 0.004;
const AR_UMIDIFICADOR_POR_S = 0.15;
const AR_HISTERESE = 5;

interface Base {
  on: boolean;
  mode: Mode;
  online: boolean;
}

export interface SimState {
  luz: Base & { reading: { presenca: boolean; sleepMin: number }; semPresencaS: number };
  projetor: Base & {
    reading: { fonte: string; autoOff: boolean; autoOffMin: number };
    semPresencaS: number;
  };
  irrigacao: Base & {
    reading: { soil: number; threshold: number; maxPumpSec: number };
    bombaS: number;
  };
  umidificador: Base & { reading: { air: number; threshold: number } };
}

export function createState(): SimState {
  return {
    luz: {
      on: true,
      mode: "auto",
      online: true,
      reading: { presenca: true, sleepMin: 10 },
      semPresencaS: 0,
    },
    projetor: {
      on: false,
      mode: "manual",
      online: true,
      reading: { fonte: "HDMI 1", autoOff: true, autoOffMin: 15 },
      semPresencaS: 0,
    },
    irrigacao: {
      on: false,
      mode: "auto",
      online: true,
      reading: { soil: 45, threshold: 30, maxPumpSec: 10 },
      bombaS: 0,
    },
    umidificador: {
      on: true,
      mode: "auto",
      online: true,
      reading: { air: 58, threshold: 80 },
    },
  };
}

export function toStatus(state: SimState, slug: DeviceSlug): DeviceStatus {
  const d = state[slug];
  const reading: Record<string, unknown> = { ...d.reading };
  if ("soil" in reading) reading.soil = Math.round(Number(reading.soil));
  if ("air" in reading) reading.air = Math.round(Number(reading.air));
  return { on: d.on, mode: d.mode, online: d.online, ...reading };
}

export interface Change {
  slug: DeviceSlug;
  message: string;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const chance = (dt: number, media: number) => 1 - Math.exp(-dt / media);

const noise = (rng: Rng, amp: number) => (rng() * 2 - 1) * amp;

export const MAX_STEP_S = 1;

export function advance(state: SimState, dt: number, rng: Rng): Change[] {
  const changes: Change[] = [];
  for (let restante = dt; restante > 0; restante -= MAX_STEP_S) {
    changes.push(...tick(state, Math.min(MAX_STEP_S, restante), rng));
  }
  return changes;
}

export function tick(state: SimState, dt: number, rng: Rng): Change[] {
  const changes: Change[] = [];
  const set = (slug: DeviceSlug, on: boolean, message: string) => {
    if (state[slug].on === on) return;
    state[slug].on = on;
    changes.push({ slug, message });
  };

  const luz = state.luz;
  if (luz.online) {
    const presente = luz.reading.presenca;
    const media = presente ? PRESENCA_MEDIA_SAIDA_S : PRESENCA_MEDIA_CHEGADA_S;
    if (rng() < chance(dt, media)) {
      luz.reading.presenca = !presente;
      changes.push({ slug: "luz", message: presente ? "sala vazia" : "presença detectada" });
    }
  }
  const presenca = luz.reading.presenca;

  if (luz.online) {
    luz.semPresencaS = presenca ? 0 : luz.semPresencaS + dt;
    if (luz.mode === "auto") {
      if (presenca) set("luz", true, "ligada por presença");
      else if (luz.semPresencaS >= luz.reading.sleepMin * 60) {
        set("luz", false, `desligada após ${luz.reading.sleepMin} min sem presença`);
      }
    }
  }

  const proj = state.projetor;
  if (proj.online) {
    proj.semPresencaS = presenca || !proj.on ? 0 : proj.semPresencaS + dt;
    if (proj.on && proj.reading.autoOff && proj.semPresencaS >= proj.reading.autoOffMin * 60) {
      set("projetor", false, `desligado após ${proj.reading.autoOffMin} min sem presença`);
    }
  }

  const irr = state.irrigacao;
  if (irr.online) {
    const r = irr.reading;
    r.soil = clamp(r.soil - SOLO_SECAGEM_POR_S * dt + noise(rng, 0.05), 0, 100);
    if (irr.on) {
      r.soil = clamp(r.soil + SOLO_BOMBA_POR_S * dt, 0, 100);
      irr.bombaS += dt;
      if (irr.bombaS >= r.maxPumpSec) {
        set("irrigacao", false, `bomba desligada após ${Math.round(irr.bombaS)} s`);
      }
    } else if (irr.mode === "auto" && r.soil < r.threshold) {
      irr.bombaS = 0;
      set("irrigacao", true, `bomba ligada — solo em ${Math.round(r.soil)}%`);
    }
  }

  const umi = state.umidificador;
  if (umi.online) {
    const r = umi.reading;
    r.air += (AR_AMBIENTE - r.air) * AR_RETORNO_POR_S * dt + noise(rng, 0.1);
    if (umi.on) r.air += AR_UMIDIFICADOR_POR_S * dt;
    r.air = clamp(r.air, 0, 100);
    if (umi.mode === "auto") {
      if (!umi.on && r.air < r.threshold) {
        set("umidificador", true, `ligado — ar em ${Math.round(r.air)}%`);
      } else if (umi.on && r.air >= r.threshold + AR_HISTERESE) {
        set("umidificador", false, `desligado — ar em ${Math.round(r.air)}%`);
      }
    }
  }

  return changes;
}

export interface CommandResult {
  ok: boolean;
  message: string;
}

const CONFIG_KEYS: Record<DeviceSlug, Record<string, "number" | "boolean" | "string">> = {
  luz: { sleepMin: "number" },
  projetor: { fonte: "string", autoOff: "boolean", autoOffMin: "number" },
  irrigacao: { threshold: "number", maxPumpSec: "number" },
  umidificador: { threshold: "number" },
};

const FONTES = ["HDMI 1", "HDMI 2", "VGA"];

export function applyCommand(
  state: SimState,
  slug: DeviceSlug,
  command: DeviceCommand,
): CommandResult {
  const d = state[slug];
  if (!d.online) return { ok: false, message: "offline — comando perdido" };

  switch (command.action) {
    case "power": {
      const on = command.value === "on" || command.value === true;
      d.on = on;
      if (slug === "irrigacao") state.irrigacao.bombaS = 0;
      if (slug === "luz") state.luz.semPresencaS = 0;
      if (slug === "projetor") state.projetor.semPresencaS = 0;
      return { ok: true, message: on ? "ligado pelo painel" : "desligado pelo painel" };
    }

    case "mode": {
      if (command.value !== "auto" && command.value !== "manual") {
        return { ok: false, message: `modo inválido: ${String(command.value)}` };
      }
      d.mode = command.value;
      return { ok: true, message: `modo ${command.value === "auto" ? "automático" : "manual"}` };
    }

    case "threshold": {
      if (!command.key) return { ok: false, message: "threshold sem `key`" };
      return patchReading(slug, d.reading, { [command.key]: command.value });
    }

    case "config": {
      const { action: _action, ...patch } = command;
      return patchReading(slug, d.reading, patch);
    }

    case "ir": {
      if (slug !== "projetor") return { ok: false, message: "IR só existe no projetor" };
      const key = String(command.key ?? "");
      if (key === "power") {
        d.on = !d.on;
        state.projetor.semPresencaS = 0;
        return { ok: true, message: `IR power → ${d.on ? "ligado" : "desligado"}` };
      }
      if (key.startsWith("source:")) {
        const fonte = key.slice("source:".length);
        if (!FONTES.includes(fonte)) return { ok: false, message: `fonte desconhecida: ${fonte}` };
        state.projetor.reading.fonte = fonte;
        return { ok: true, message: `IR fonte → ${fonte}` };
      }
      return { ok: true, message: `IR "${key}" recebido` };
    }

    default:
      return { ok: false, message: `ação desconhecida: ${command.action}` };
  }
}

function patchReading(
  slug: DeviceSlug,
  reading: Record<string, unknown>,
  patch: Record<string, unknown>,
): CommandResult {
  const allowed = CONFIG_KEYS[slug];
  const aplicadas: string[] = [];
  const ignoradas: string[] = [];

  for (const [key, raw] of Object.entries(patch)) {
    const tipo = allowed[key];
    const value = tipo === "number" && typeof raw === "string" ? Number(raw) : raw;
    const valido =
      tipo !== undefined &&
      typeof value === tipo &&
      (tipo !== "number" || (Number.isFinite(value) && (value as number) >= 0)) &&
      (key !== "fonte" || FONTES.includes(value as string));
    if (valido) {
      reading[key] = value;
      aplicadas.push(`${key}=${String(value)}`);
    } else {
      ignoradas.push(key);
    }
  }

  if (!aplicadas.length) {
    return { ok: false, message: `nenhuma configuração válida (${ignoradas.join(", ") || "vazio"})` };
  }
  const extra = ignoradas.length ? ` (ignorado: ${ignoradas.join(", ")})` : "";
  return { ok: true, message: `config ${aplicadas.join(", ")}${extra}` };
}

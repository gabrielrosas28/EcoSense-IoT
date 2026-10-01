import { z } from "../lib/zod.js";

/**
 * Os subsistemas da sala: o que é fixo em cada um, o que o painel pode
 * ajustar e o que o próprio dispositivo mede.
 *
 * - `settings`: chaves de `reading` que o painel pode alterar (comandos
 *   `threshold` e `config`), com os mesmos limites dos sliders do frontend e
 *   as mesmas chaves que o simulador aceita (simulator/README.md).
 * - `sensors`: medições que só o dispositivo informa, no status MQTT.
 *
 * O status do dispositivo pode trazer as duas coisas; o painel, só `settings`.
 */

export const PROJECTOR_SOURCES = ["HDMI 1", "HDMI 2", "VGA"];

/** Teclas do controle remoto IR do projetor (frontend: pages/Projetor.jsx). */
export const IR_KEYS = ["up", "down", "left", "right", "ok", "menu", "back", "vol+", "vol-"];

const minutes = z.number().int().min(1).max(60);
const percent = z.number().min(0).max(100);

export const DEVICE_CATALOG = {
  luz: {
    name: "Iluminação",
    accent: "var(--amber)",
    feminine: true, // concordância no histórico: "Iluminação ligada pelo painel"
    settings: { sleepMin: minutes },
    sensors: { presenca: z.boolean() },
  },
  projetor: {
    name: "Projetor",
    accent: "var(--blue)",
    infrared: true,
    settings: {
      fonte: z.enum(PROJECTOR_SOURCES),
      autoOff: z.boolean(),
      autoOffMin: minutes,
    },
    sensors: {},
  },
  irrigacao: {
    name: "Irrigação",
    accent: "var(--leaf)",
    feminine: true,
    settings: {
      threshold: z.number().int().min(5).max(90),
      maxPumpSec: z.number().int().min(1).max(60),
    },
    sensors: { soil: percent },
  },
  umidificador: {
    name: "Umidificador",
    accent: "var(--teal)",
    settings: { threshold: z.number().int().min(20).max(95) },
    sensors: { air: percent },
  },
};

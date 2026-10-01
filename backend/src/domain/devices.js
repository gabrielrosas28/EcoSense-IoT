import { z } from "../lib/zod.js";

/**
 * Os subsistemas da sala: o que é fixo em cada um e o que o painel pode ajustar.
 *
 * `settings` lista as chaves de `reading` que o painel pode alterar (comandos
 * `threshold` e `config`), com os mesmos limites dos sliders do frontend e as
 * mesmas chaves que o simulador aceita (simulator/README.md). O resto de
 * `reading` é medição de sensor (soil, air, presenca), que só o próprio
 * dispositivo atualiza.
 */

export const PROJECTOR_SOURCES = ["HDMI 1", "HDMI 2", "VGA"];

/** Teclas do controle remoto IR do projetor (frontend: pages/Projetor.jsx). */
export const IR_KEYS = ["up", "down", "left", "right", "ok", "menu", "back", "vol+", "vol-"];

const minutes = z.number().int().min(1).max(60);

export const DEVICE_CATALOG = {
  luz: {
    name: "Iluminação",
    accent: "var(--amber)",
    feminine: true, // concordância no histórico: "Iluminação ligada pelo painel"
    settings: { sleepMin: minutes },
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
  },
  irrigacao: {
    name: "Irrigação",
    accent: "var(--leaf)",
    feminine: true,
    settings: {
      threshold: z.number().int().min(5).max(90),
      maxPumpSec: z.number().int().min(1).max(60),
    },
  },
  umidificador: {
    name: "Umidificador",
    accent: "var(--teal)",
    settings: { threshold: z.number().int().min(20).max(95) },
  },
};

import { z } from "../lib/zod.js";

export const PROJECTOR_SOURCES = ["HDMI 1", "HDMI 2", "VGA"];

export const IR_KEYS = ["up", "down", "left", "right", "ok", "menu", "back", "vol+", "vol-"];

const minutes = z.number().int().min(1).max(60);
const percent = z.number().min(0).max(100);

export const DEVICE_CATALOG = {
  luz: {
    name: "Iluminação",
    accent: "var(--amber)",
    feminine: true,
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

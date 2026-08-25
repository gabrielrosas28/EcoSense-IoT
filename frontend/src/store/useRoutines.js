import { create } from "zustand";
import { api } from "../services/api";

/** Sensores disponíveis no construtor SE -> ENTÃO. */
export const SENSORS = [
  { id: "soil", label: "Umidade do solo", unit: "%", device: "irrigacao" },
  { id: "air", label: "Umidade do ar", unit: "%", device: "umidificador" },
  { id: "presenca", label: "Presença na sala", unit: "", device: "luz" },
  { id: "hora", label: "Horário", unit: "h", device: null },
];

export const OPERATORS = [
  { id: "lt", label: "menor que" },
  { id: "gt", label: "maior que" },
  { id: "eq", label: "igual a" },
];

export const ACTIONS = [
  { id: "on", label: "Ligar" },
  { id: "off", label: "Desligar" },
];

const seed = [
  {
    id: "r1",
    sensor: "soil",
    operator: "lt",
    value: 30,
    action: "on",
    device: "irrigacao",
    enabled: true,
  },
  {
    id: "r2",
    sensor: "air",
    operator: "lt",
    value: 80,
    action: "on",
    device: "umidificador",
    enabled: true,
  },
  {
    id: "r3",
    sensor: "presenca",
    operator: "eq",
    value: 0,
    action: "off",
    device: "luz",
    enabled: false,
  },
];

let seq = 0;

export const useRoutines = create((set, get) => ({
  routines: seed,

  add(routine) {
    const item = { id: `r-${Date.now()}-${seq++}`, enabled: true, ...routine };
    set((s) => ({ routines: [...s.routines, item] }));
    api.createRoutine(item);
    return item;
  },

  toggle(id) {
    const target = get().routines.find((r) => r.id === id);
    if (!target) return;
    const enabled = !target.enabled;
    set((s) => ({
      routines: s.routines.map((r) => (r.id === id ? { ...r, enabled } : r)),
    }));
    api.updateRoutine(id, { enabled });
  },

  remove(id) {
    set((s) => ({ routines: s.routines.filter((r) => r.id !== id) }));
    api.deleteRoutine(id);
  },
}));

/** Descreve a rotina em texto — "Se solo menor que 30% então ligar Irrigação". */
export function describeRoutine(routine, devices) {
  const sensor = SENSORS.find((s) => s.id === routine.sensor);
  const operator = OPERATORS.find((o) => o.id === routine.operator);
  const action = ACTIONS.find((a) => a.id === routine.action);
  const device = devices?.[routine.device];

  const value =
    routine.sensor === "presenca"
      ? Number(routine.value) === 1
        ? "detectada"
        : "não detectada"
      : `${routine.value}${sensor?.unit ?? ""}`;

  return {
    condition: `${sensor?.label ?? routine.sensor} ${
      routine.sensor === "presenca" ? "" : `${operator?.label ?? ""} `
    }${value}`.trim(),
    consequence: `${action?.label ?? routine.action} ${device?.name ?? routine.device}`,
  };
}

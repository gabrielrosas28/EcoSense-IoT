import { create } from "zustand";
import { api } from "../services/api";

/**
 * Fonte única da verdade do estado dos dispositivos.
 *
 * Sidebar, DeviceCard (dashboard) e as páginas de detalhe leem TODOS daqui.
 * Nenhuma tela guarda `on`/`mode`/`threshold` em useState local.
 */

export const DEVICE_ORDER = ["luz", "projetor", "irrigacao", "umidificador"];

const initialDevices = {
  luz: {
    id: "luz",
    name: "Iluminação",
    path: "/luz",
    accent: "var(--amber)",
    mode: "auto",
    on: true,
    online: true,
    reading: { presenca: true, sleepMin: 10 },
  },
  projetor: {
    id: "projetor",
    name: "Projetor",
    path: "/projetor",
    accent: "var(--blue)",
    mode: "manual",
    on: false,
    online: true,
    reading: { fonte: "HDMI 1", autoOff: true, autoOffMin: 15 },
  },
  irrigacao: {
    id: "irrigacao",
    name: "Irrigação",
    path: "/irrigacao",
    accent: "var(--leaf)",
    mode: "auto",
    on: false,
    online: true,
    reading: { soil: 45, threshold: 30, maxPumpSec: 10 },
  },
  umidificador: {
    id: "umidificador",
    name: "Umidificador",
    path: "/umidificador",
    accent: "var(--teal)",
    mode: "auto",
    on: true,
    online: true,
    reading: { air: 58, threshold: 80 },
  },
};

const seedEvents = [
  { id: "e1", device: "irrigacao", text: "Irrigação concluída — 8 s de bomba", at: "07:12" },
  { id: "e2", device: "umidificador", text: "Umidificador ligado — ar em 56%", at: "06:40" },
  { id: "e3", device: "luz", text: "Iluminação desligada por ausência de presença", at: "22:35" },
  { id: "e4", device: "projetor", text: "Projetor desligado automaticamente", at: "21:58" },
];

/** Qual chave do `reading` guarda o limite de cada dispositivo. */
const THRESHOLD_KEY = {
  luz: "sleepMin",
  projetor: "autoOffMin",
  irrigacao: "threshold",
  umidificador: "threshold",
};

let eventSeq = 0;
const nextEventId = () => `ev-${Date.now()}-${eventSeq++}`;

const nowLabel = () =>
  new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export const useDevices = create((set, get) => ({
  devices: initialDevices,
  events: seedEvents,
  /** Feedback curto de UI ("Enviado por IR: …"). */
  toasts: [],

  // ---------- helpers internos ----------

  patchDevice(id, patch) {
    set((s) => {
      const current = s.devices[id];
      if (!current) return s;
      return { devices: { ...s.devices, [id]: { ...current, ...patch } } };
    });
  },

  pushEvent(device, text) {
    set((s) => ({
      events: [{ id: nextEventId(), device, text, at: nowLabel() }, ...s.events].slice(0, 40),
    }));
  },

  notify(message) {
    const id = nextEventId();
    set((s) => ({ toasts: [...s.toasts, { id, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 2600);
  },

  // ---------- actions (as únicas que mudam estado) ----------

  setOn(id, value) {
    const device = get().devices[id];
    if (!device) return;
    get().patchDevice(id, { on: value });
    get().pushEvent(id, `${device.name} ${value ? "ligado" : "desligado"} pelo painel`);
    api.sendCommand(id, { action: "power", value: value ? "on" : "off" });
  },

  toggleOn(id) {
    const device = get().devices[id];
    if (device) get().setOn(id, !device.on);
  },

  setMode(id, mode) {
    const device = get().devices[id];
    if (!device) return;
    get().patchDevice(id, { mode });
    get().pushEvent(id, `${device.name} em modo ${mode === "auto" ? "automático" : "manual"}`);
    api.sendCommand(id, { action: "mode", value: mode });
  },

  setThreshold(id, value) {
    const key = THRESHOLD_KEY[id];
    if (!key) return;
    get().setReading(id, { [key]: value });
    api.sendCommand(id, { action: "threshold", key, value });
  },

  /** Atualiza leitura/config de um dispositivo. `silent` evita reenviar ao backend. */
  setReading(id, patch, { silent = false } = {}) {
    const device = get().devices[id];
    if (!device) return;
    get().patchDevice(id, { reading: { ...device.reading, ...patch } });
    if (!silent) api.sendCommand(id, { action: "config", ...patch });
  },

  setOnline(id, online) {
    get().patchDevice(id, { online });
  },

  /**
   * Chamado pelo WebSocket (services/realtime.js) — só atualiza o store,
   * nunca reenvia comando ao backend.
   *
   * Topico esperado: `ecosense/<deviceId>/status` (contrato MQTT da raiz).
   * Payload: { on?, mode?, online?, ...leituras }
   */
  applyIncoming(topic, payload) {
    if (!payload) return;
    const id = String(topic || "")
      .split("/")
      .find((part) => part in get().devices);
    if (!id) return;

    const { on, mode, online, ...reading } = payload;
    const patch = {};
    if (typeof on === "boolean") patch.on = on;
    if (mode === "auto" || mode === "manual") patch.mode = mode;
    if (typeof online === "boolean") patch.online = online;
    if (Object.keys(reading).length) {
      patch.reading = { ...get().devices[id].reading, ...reading };
    }
    get().patchDevice(id, patch);
  },
}));

/** Lê um dispositivo do store (assina só aquele dispositivo). */
export const useDevice = (id) => useDevices((s) => s.devices[id]);

/** Lista ordenada para a Sidebar e o Dashboard. */
export const useDeviceList = () => {
  // seleciona o mapa (referência estável) e ordena fora do seletor,
  // senão o snapshot mudaria a cada render.
  const devices = useDevices((s) => s.devices);
  return DEVICE_ORDER.map((id) => devices[id]);
};

/** Ações não mudam de identidade — pegar direto evita re-render. */
export const deviceActions = {
  setOn: (...a) => useDevices.getState().setOn(...a),
  toggleOn: (...a) => useDevices.getState().toggleOn(...a),
  setMode: (...a) => useDevices.getState().setMode(...a),
  setThreshold: (...a) => useDevices.getState().setThreshold(...a),
  setReading: (...a) => useDevices.getState().setReading(...a),
  applyIncoming: (...a) => useDevices.getState().applyIncoming(...a),
  notify: (...a) => useDevices.getState().notify(...a),
  pushEvent: (...a) => useDevices.getState().pushEvent(...a),
};

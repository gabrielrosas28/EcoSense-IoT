/**
 * REST com o backend. O frontend NUNCA fala MQTT direto —
 * o backend traduz MQTT <-> REST/WebSocket.
 *
 * Fase 1 (mock): sem backend no ar, as chamadas falham silenciosamente
 * e a UI continua funcionando pelo store.
 */

const BASE = import.meta.env.VITE_API_URL ?? "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.status === 204 ? null : res.json();
}

export const api = {
  /**
   * Envia um comando para um dispositivo. O backend publica no tópico
   * de comando correspondente (contrato MQTT da raiz).
   */
  sendCommand(id, command) {
    return request(`/devices/${id}/command`, {
      method: "POST",
      body: JSON.stringify(command),
    }).catch((err) => {
      // Sem backend ainda: registra e segue — o store já foi atualizado.
      console.warn(`[api] comando não entregue (${id})`, command, err.message);
      return null;
    });
  },

  getDevices() {
    return request("/devices").catch(() => null);
  },

  getRoutines() {
    return request("/routines").catch(() => null);
  },

  createRoutine(routine) {
    return request("/routines", {
      method: "POST",
      body: JSON.stringify(routine),
    }).catch(() => null);
  },

  updateRoutine(id, patch) {
    return request(`/routines/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }).catch(() => null);
  },

  deleteRoutine(id) {
    return request(`/routines/${id}`, { method: "DELETE" }).catch(() => null);
  },

  login(email, password) {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }).catch(() => null);
  },
};

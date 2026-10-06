/**
 * REST com o backend. O frontend NUNCA fala MQTT direto —
 * o backend traduz MQTT <-> REST/WebSocket.
 *
 * Fase 1 (mock): sem backend no ar, as chamadas de dispositivo/rotina falham
 * silenciosamente e a UI continua funcionando pelo store. Autenticação é a
 * exceção: erros de login sobem para a tela tratar.
 */

const BASE = import.meta.env.VITE_API_URL ?? "/api";

/** Erro HTTP com a mensagem que o backend mandou em `{ error }`. */
export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }

  /** Backend fora do ar: falha de rede ou gateway do proxy do Vite. */
  get offline() {
    return this.status === 0 || this.status === 502 || this.status === 503 || this.status === 504;
  }
}

// Token da sessão em memória — quem define é o store de auth (store/useAuth.js).
let authToken = null;
let onUnauthorized = null;

export function setAuthToken(token) {
  authToken = token;
}

/** Chamado quando uma rota autenticada responde 401 (token expirado/inválido). */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, "Não foi possível conectar ao servidor");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    if (res.status === 401 && authToken && onUnauthorized) onUnauthorized();
    throw new ApiError(res.status, body?.error ?? `${res.status} ${res.statusText}`, body?.details);
  }
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

  /**
   * Histórico dos sensores: `{ device, from, to, interval, series: { soil: [{ at, value }] } }`.
   * `params`: `sensor`, `from`/`to` (ISO), `interval` (1m, 5m, 15m, 1h, 1d), `limit`.
   */
  getReadings(id, params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/devices/${id}/readings${query ? `?${query}` : ""}`).catch(() => null);
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

  /** `{ token, user }` — lança ApiError (401 credenciais, 400 validação...). */
  login(email, password) {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  /** Usuário do token atual. */
  me() {
    return request("/auth/me");
  },
};

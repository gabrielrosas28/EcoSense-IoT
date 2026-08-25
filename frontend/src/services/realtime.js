import { useDevices } from "../store/useDevices";

/**
 * WebSocket com o backend: cada mensagem vira `applyIncoming(topic, payload)`.
 * O backend repassa os tópicos/payloads do contrato MQTT (CLAUDE.md da raiz).
 *
 * Mensagem esperada: { "topic": "ecosense/luz/status", "payload": { "on": true } }
 */

const WS_URL =
  import.meta.env.VITE_WS_URL ??
  `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;

const RETRY_MS = 4000;

let socket = null;
let retryTimer = null;
let stopped = false;

function handleMessage(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    console.warn("[realtime] mensagem inválida", raw);
    return;
  }
  const { applyIncoming } = useDevices.getState();
  const list = Array.isArray(data) ? data : [data];
  for (const msg of list) {
    if (msg && msg.topic) applyIncoming(msg.topic, msg.payload ?? msg.data);
  }
}

function scheduleRetry() {
  if (stopped || retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    connect();
  }, RETRY_MS);
}

export function connect() {
  if (stopped || socket) return;
  try {
    socket = new WebSocket(WS_URL);
  } catch (err) {
    console.warn("[realtime] falha ao abrir WebSocket", err.message);
    socket = null;
    scheduleRetry();
    return;
  }

  socket.onmessage = (ev) => handleMessage(ev.data);

  socket.onclose = () => {
    socket = null;
    scheduleRetry();
  };

  socket.onerror = () => {
    // onclose vem logo depois e cuida do retry.
    socket?.close();
  };
}

export function disconnect() {
  stopped = true;
  clearTimeout(retryTimer);
  retryTimer = null;
  socket?.close();
  socket = null;
}

/** Usado pelo App: liga o realtime enquanto o app estiver montado. */
export function startRealtime() {
  stopped = false;
  connect();
  return disconnect;
}

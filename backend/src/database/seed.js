import { DEVICE_CATALOG } from "../domain/devices.js";
import { hashPassword } from "../lib/password.js";

/** Usuário de desenvolvimento, o mesmo citado no `.env.example` do frontend. */
export const DEV_USER = {
  name: "Administrador",
  email: "admin@ecosense.local",
  password: "ecosense123",
};

/** Estado inicial de cada dispositivo, igual ao mock do frontend (store/useDevices.js). */
const INITIAL_STATE = {
  luz: { on: true, mode: "auto", reading: { presenca: true, sleepMin: 10 } },
  projetor: { on: false, mode: "manual", reading: { fonte: "HDMI 1", autoOff: true, autoOffMin: 15 } },
  irrigacao: { on: false, mode: "auto", reading: { soil: 45, threshold: 30, maxPumpSec: 10 } },
  umidificador: { on: true, mode: "auto", reading: { air: 58, threshold: 80 } },
};

/** Rotinas de exemplo, iguais às do mock do frontend (store/useRoutines.js). */
const ROUTINES = [
  { id: "r1", sensor: "soil", operator: "lt", value: 30, action: "on", device: "irrigacao", enabled: true },
  { id: "r2", sensor: "air", operator: "lt", value: 80, action: "on", device: "umidificador", enabled: true },
  { id: "r3", sensor: "presenca", operator: "eq", value: 0, action: "off", device: "luz", enabled: false },
];

/** Histórico de exemplo (mock do frontend), com horários relativos a agora. */
const EVENTS = [
  { device: "irrigacao", message: "Irrigação concluída — 8 s de bomba", minutesAgo: 25 },
  { device: "umidificador", message: "Umidificador ligado — ar em 56%", minutesAgo: 57 },
  { device: "luz", message: "Iluminação desligada por ausência de presença", minutesAgo: 9 * 60 },
  { device: "projetor", message: "Projetor desligado automaticamente", minutesAgo: 10 * 60 },
];

/**
 * Popula o banco com o estado inicial do protótipo. Pode rodar quantas vezes
 * quiser: não duplica nada e não sobrescreve o estado atual dos dispositivos.
 */
export async function seed(db, { log = console.info } = {}) {
  let position = 0;
  for (const [id, device] of Object.entries(DEVICE_CATALOG)) {
    const state = INITIAL_STATE[id];
    await db.query(
      `INSERT INTO devices (id, name, accent, position, is_on, mode, online, reading)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7)
       ON CONFLICT (id) DO NOTHING`,
      [id, device.name, device.accent, ++position, state.on, state.mode, JSON.stringify(state.reading)],
    );
  }

  for (const routine of ROUTINES) {
    await db.query(
      `INSERT INTO routines (id, sensor, operator, value, action, device_id, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [routine.id, routine.sensor, routine.operator, routine.value, routine.action, routine.device, routine.enabled],
    );
  }

  const { rows } = await db.query("SELECT EXISTS (SELECT 1 FROM events) AS has_events");
  if (!rows[0].has_events) {
    for (const event of EVENTS) {
      await db.query(
        `INSERT INTO events (device_id, message, source, created_at)
         VALUES ($1, $2, 'device', now() - make_interval(mins => $3))`,
        [event.device, event.message, event.minutesAgo],
      );
    }
  }

  await seedReadings(db);

  await db.query(
    `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT ((lower(email))) DO NOTHING`,
    [DEV_USER.name, DEV_USER.email, await hashPassword(DEV_USER.password)],
  );

  log(`[db] seed ok: ${Object.keys(DEVICE_CATALOG).length} dispositivos, ${ROUTINES.length} rotinas, usuário ${DEV_USER.email}`);
}

/**
 * 24 h de leituras de exemplo, uma a cada 15 min, para os gráficos não
 * nascerem vazios: solo secando devagar, ar oscilando e presença no horário
 * de aula (7h às 18h no fuso da escola). Só roda com a tabela vazia; depois
 * quem alimenta a série é o status MQTT.
 */
async function seedReadings(db) {
  const { rows } = await db.query("SELECT EXISTS (SELECT 1 FROM readings) AS has_readings");
  if (rows[0].has_readings) return;

  await db.query(
    `INSERT INTO readings (device_id, sensor, value, recorded_at)
     SELECT s.device_id, s.sensor,
            CASE s.sensor
              WHEN 'soil' THEN round((45 + 10 * sin(extract(epoch FROM t) / 9000))::numeric, 1)
              WHEN 'air'  THEN round((58 + 6 * cos(extract(epoch FROM t) / 5400))::numeric, 1)
              ELSE CASE WHEN extract(hour FROM t AT TIME ZONE 'America/Sao_Paulo') BETWEEN 7 AND 17 THEN 1 ELSE 0 END
            END,
            t
       FROM generate_series(now() - interval '23 hours 45 minutes', now(), interval '15 minutes') AS t
      CROSS JOIN (VALUES ('irrigacao', 'soil'), ('umidificador', 'air'), ('luz', 'presenca')) AS s (device_id, sensor)`,
  );
}

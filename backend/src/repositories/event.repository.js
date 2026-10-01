import { pool } from "../database/pool.js";

// SQL do histórico de eventos (EventList do dashboard).

export async function create({ deviceId = null, message, source = "system" }, db = pool) {
  await db.query("INSERT INTO events (device_id, message, source) VALUES ($1, $2, $3)", [
    deviceId,
    message,
    source,
  ]);
}

/** Mais recentes primeiro; `deviceId` opcional filtra por dispositivo. */
export async function findRecent({ limit, deviceId = null }, db = pool) {
  const { rows } = await db.query(
    `SELECT id, device_id, message, source, created_at
       FROM events
      WHERE $2::text IS NULL OR device_id = $2
      ORDER BY created_at DESC, id DESC
      LIMIT $1`,
    [limit, deviceId],
  );
  return rows.map((row) => ({
    id: String(row.id),
    device: row.device_id,
    text: row.message,
    source: row.source,
    createdAt: row.created_at,
  }));
}

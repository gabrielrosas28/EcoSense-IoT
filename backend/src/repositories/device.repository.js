import { pool } from "../database/pool.js";

// SQL dos dispositivos. Devolve objetos no formato do store do frontend
// (store/useDevices.js): o nome das colunas não sai daqui.

const COLUMNS = "id, name, accent, is_on, mode, online, reading, last_seen_at";

export async function findAll(db = pool) {
  const { rows } = await db.query(`SELECT ${COLUMNS} FROM devices ORDER BY position, id`);
  return rows.map(toDevice);
}

export async function findById(id, db = pool) {
  const { rows } = await db.query(`SELECT ${COLUMNS} FROM devices WHERE id = $1`, [id]);
  return rows[0] ? toDevice(rows[0]) : null;
}

/**
 * Aplica um patch de estado. `reading` é mesclado (`jsonb ||`), nunca
 * substituído: ajustar um limite não apaga a última leitura do sensor.
 */
export async function updateState(id, { on, mode, reading }, db = pool) {
  const { rows } = await db.query(
    `UPDATE devices
        SET is_on   = COALESCE($2, is_on),
            mode    = COALESCE($3, mode),
            reading = reading || COALESCE($4::jsonb, '{}'::jsonb)
      WHERE id = $1
      RETURNING ${COLUMNS}`,
    [id, on ?? null, mode ?? null, reading ? JSON.stringify(reading) : null],
  );
  return rows[0] ? toDevice(rows[0]) : null;
}

function toDevice(row) {
  return {
    id: row.id,
    name: row.name,
    accent: row.accent,
    on: row.is_on,
    mode: row.mode,
    online: row.online,
    reading: row.reading,
    lastSeenAt: row.last_seen_at,
  };
}

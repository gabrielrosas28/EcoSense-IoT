import { pool } from "../database/pool.js";

const COLUMNS = "id, name, accent, is_on, mode, online, reading, last_seen_at";

export async function findAll(db = pool) {
  const { rows } = await db.query(`SELECT ${COLUMNS} FROM devices ORDER BY position, id`);
  return rows.map(toDevice);
}

export async function findById(id, db = pool) {
  const { rows } = await db.query(`SELECT ${COLUMNS} FROM devices WHERE id = $1`, [id]);
  return rows[0] ? toDevice(rows[0]) : null;
}

export async function findForUpdate(id, db) {
  const { rows } = await db.query(`SELECT ${COLUMNS} FROM devices WHERE id = $1 FOR UPDATE`, [id]);
  return rows[0] ? toDevice(rows[0]) : null;
}

export async function updateState(id, { on, mode, reading, online, seen = false }, db = pool) {
  const { rows } = await db.query(
    `UPDATE devices
        SET is_on        = COALESCE($2, is_on),
            mode         = COALESCE($3, mode),
            reading      = reading || COALESCE($4::jsonb, '{}'::jsonb),
            online       = COALESCE($5, online),
            last_seen_at = CASE WHEN $6 THEN now() ELSE last_seen_at END
      WHERE id = $1
      RETURNING ${COLUMNS}`,
    [id, on ?? null, mode ?? null, reading ? JSON.stringify(reading) : null, online ?? null, seen],
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

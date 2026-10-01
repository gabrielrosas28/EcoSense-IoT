import { pool } from "../database/pool.js";

// SQL das rotinas. Devolve objetos no formato do store do frontend
// (store/useRoutines.js): `device` é o id do dispositivo.

const COLUMNS = "id, sensor, operator, value, action, device_id, enabled, created_at";

export async function findAll(db = pool) {
  // Mais antigas primeiro: o frontend acrescenta rotinas novas no fim da lista.
  const { rows } = await db.query(`SELECT ${COLUMNS} FROM routines ORDER BY created_at, id`);
  return rows.map(toRoutine);
}

export async function findById(id, db = pool) {
  const { rows } = await db.query(`SELECT ${COLUMNS} FROM routines WHERE id = $1`, [id]);
  return rows[0] ? toRoutine(rows[0]) : null;
}

export async function insert(routine, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO routines (id, sensor, operator, value, action, device_id, enabled)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${COLUMNS}`,
    [routine.id, routine.sensor, routine.operator, routine.value, routine.action, routine.device, routine.enabled],
  );
  return toRoutine(rows[0]);
}

export async function update(id, routine, db = pool) {
  const { rows } = await db.query(
    `UPDATE routines
        SET sensor = $2, operator = $3, value = $4, action = $5, device_id = $6, enabled = $7
      WHERE id = $1
      RETURNING ${COLUMNS}`,
    [id, routine.sensor, routine.operator, routine.value, routine.action, routine.device, routine.enabled],
  );
  return rows[0] ? toRoutine(rows[0]) : null;
}

/** Devolve `true` se apagou alguma coisa. */
export async function remove(id, db = pool) {
  const { rowCount } = await db.query("DELETE FROM routines WHERE id = $1", [id]);
  return rowCount > 0;
}

function toRoutine(row) {
  return {
    id: row.id,
    sensor: row.sensor,
    operator: row.operator,
    value: row.value,
    action: row.action,
    device: row.device_id,
    enabled: row.enabled,
    createdAt: row.created_at,
  };
}

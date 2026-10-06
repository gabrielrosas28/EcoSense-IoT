import { pool } from "../database/pool.js";

// SQL dos usuários. `passwordHash` só sai daqui para o auth.service conferir a
// senha; nenhuma resposta da API o inclui.

const COLUMNS = "id, name, email, password_hash";

/** Busca sem diferenciar maiúsculas (o índice único é em lower(email)). */
export async function findByEmail(email, db = pool) {
  const { rows } = await db.query(`SELECT ${COLUMNS} FROM users WHERE lower(email) = lower($1)`, [email]);
  return rows[0] ? toUser(rows[0]) : null;
}

export async function findById(id, db = pool) {
  const { rows } = await db.query(`SELECT ${COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] ? toUser(rows[0]) : null;
}

/**
 * Grava um usuário novo. Recebe o hash, nunca a senha. E-mail repetido viola o
 * índice único `users_email_key` e o erro sobe com o código 23505 do PostgreSQL.
 */
export async function create({ name, email, passwordHash }, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING ${COLUMNS}`,
    [name, email, passwordHash],
  );
  return toUser(rows[0]);
}

function toUser(row) {
  return { id: row.id, name: row.name, email: row.email, passwordHash: row.password_hash };
}

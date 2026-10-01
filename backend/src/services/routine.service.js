import { randomUUID } from "node:crypto";
import { routineProblems } from "../domain/routines.js";
import { HttpError } from "../lib/httpError.js";
import * as devices from "../repositories/device.repository.js";
import * as routines from "../repositories/routine.repository.js";

const UNIQUE_VIOLATION = "23505";

export function listRoutines() {
  return routines.findAll();
}

export async function createRoutine(input) {
  const routine = { ...input, id: input.id ?? randomUUID() };
  await ensureValid(routine);

  try {
    return await routines.insert(routine);
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) {
      throw HttpError.conflict(`Já existe uma rotina com o id "${routine.id}"`);
    }
    throw err;
  }
}

export async function updateRoutine(id, patch) {
  const current = await routines.findById(id);
  if (!current) throw notFound(id);

  const next = { ...current, ...patch };
  await ensureValid(next);

  const updated = await routines.update(id, next);
  if (!updated) throw notFound(id); // apagada entre a leitura e a escrita
  return updated;
}

export async function deleteRoutine(id) {
  if (!(await routines.remove(id))) throw notFound(id);
}

/** Regras entre campos (domain/routines.js) e dispositivo existente. */
async function ensureValid(routine) {
  const problems = routineProblems(routine);
  if (!(await devices.findById(routine.device))) {
    problems.push({ campo: "device", erro: `o dispositivo "${routine.device}" não existe` });
  }
  if (problems.length > 0) throw HttpError.badRequest("Rotina inválida", problems);
}

function notFound(id) {
  return HttpError.notFound(`Rotina "${id}" não existe`);
}

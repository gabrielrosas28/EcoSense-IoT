import * as routineService from "../services/routine.service.js";

export async function list(_req, res) {
  res.json(await routineService.listRoutines());
}

export async function create(req, res) {
  res.status(201).json(await routineService.createRoutine(req.validated.body));
}

export async function update(req, res) {
  res.json(await routineService.updateRoutine(req.validated.params.id, req.validated.body));
}

export async function remove(req, res) {
  await routineService.deleteRoutine(req.validated.params.id);
  res.status(204).end();
}

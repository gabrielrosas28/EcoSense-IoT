import type { Request, Response } from "express";
import * as routines from "../services/routine.service.ts";
import type { RoutineInput, RoutinePatch } from "../services/routine.service.ts";

export async function index(_req: Request, res: Response): Promise<void> {
  res.json(await routines.list());
}

export async function create(req: Request, res: Response): Promise<void> {
  const routine = await routines.create(req.body as RoutineInput, req.user?.id ?? null);
  res.status(201).json(routine);
}

export async function update(req: Request, res: Response): Promise<void> {
  const routine = await routines.update(req.params["id"] as string, req.body as RoutinePatch);
  res.json(routine);
}

export async function remove(req: Request, res: Response): Promise<void> {
  await routines.remove(req.params["id"] as string);
  res.status(204).end();
}

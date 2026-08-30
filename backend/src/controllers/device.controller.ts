import type { Request, Response } from "express";
import * as devices from "../services/device.service.ts";
import * as events from "../services/event.service.ts";
import type { DeviceCommand, DeviceStatus } from "../types/api.ts";

export async function index(_req: Request, res: Response): Promise<void> {
  res.json(await devices.list());
}

export async function show(req: Request, res: Response): Promise<void> {
  res.json(await devices.show(req.params["slug"] as string));
}

export async function command(req: Request, res: Response): Promise<void> {
  const resultado = await devices.sendCommand(
    req.params["slug"] as string,
    req.body as DeviceCommand,
  );
  res.status(202).json(resultado);
}

export async function status(req: Request, res: Response): Promise<void> {
  const atualizado = await devices.applyIncomingStatus(
    req.params["slug"] as string,
    req.body as DeviceStatus,
  );
  res.json(atualizado);
}

export async function history(req: Request, res: Response): Promise<void> {
  const limit = (req.validatedQuery?.["limit"] as number | undefined) ?? 40;
  res.json(await events.list({ limit }));
}

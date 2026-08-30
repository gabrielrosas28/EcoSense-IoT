import type { Request, Response } from "express";
import * as auth from "../services/auth.service.ts";

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };
  res.json(await auth.login(email, password));
}

export async function me(req: Request, res: Response): Promise<void> {
  res.json(await auth.me(req.user!.id));
}

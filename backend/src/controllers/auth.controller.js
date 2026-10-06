import * as authService from "../services/auth.service.js";

export async function login(req, res) {
  const { email, password } = req.validated.body;
  res.json(await authService.login(email, password));
}

export async function register(req, res) {
  res.status(201).json(await authService.register(req.validated.body));
}

export async function me(req, res) {
  res.json(await authService.getProfile(req.user.id));
}

import * as healthService from "../services/health.service.js";

export async function show(_req, res) {
  const health = await healthService.getHealth();
  res.status(health.database === "up" ? 200 : 503).json(health);
}

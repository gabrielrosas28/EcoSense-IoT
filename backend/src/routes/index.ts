import { Router } from "express";
import { authRoutes } from "./auth.routes.ts";
import { deviceRoutes } from "./device.routes.ts";
import { healthRoutes } from "./health.routes.ts";
import { routineRoutes } from "./routine.routes.ts";

/**
 * Router raiz da API. Montado em `/api` (o proxy do Vite aponta pra cá).
 *
 * Uma linha por recurso — quem chegar depois adiciona o módulo aqui e mais
 * nada. As rotas ficam em `routes/`, a regra de negócio em `services/`.
 */
export const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/devices", deviceRoutes);
router.use("/routines", routineRoutes);

router.get("/", (_req, res) => {
  res.json({
    name: "EcoSense IoT API",
    version: "0.1.0",
    endpoints: ["/api/health", "/api/auth", "/api/devices", "/api/routines"],
  });
});

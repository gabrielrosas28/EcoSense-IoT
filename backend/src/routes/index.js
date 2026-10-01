import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { authRoutes } from "./auth.routes.js";
import { deviceRoutes } from "./device.routes.js";
import { eventRoutes } from "./event.routes.js";
import { healthRoutes } from "./health.routes.js";
import { routineRoutes } from "./routine.routes.js";

/**
 * Router raiz, montado em `/api` (o proxy do Vite encaminha para cá).
 * Uma linha por recurso: recurso novo ganha um arquivo em `routes/` e uma
 * linha aqui, no grupo certo.
 */
export const apiRouter = Router();

apiRouter.get("/", (_req, res) => {
  res.json({ name: "EcoSense IoT API", health: "/api/health" });
});

// Públicas
apiRouter.use("/health", healthRoutes);
apiRouter.use("/auth", authRoutes); // login é público; /auth/me exige token

// Protegidas: exigem `Authorization: Bearer <token>` (obtido em /auth/login)
apiRouter.use("/devices", requireAuth, deviceRoutes);
apiRouter.use("/routines", requireAuth, routineRoutes);
apiRouter.use("/events", requireAuth, eventRoutes);

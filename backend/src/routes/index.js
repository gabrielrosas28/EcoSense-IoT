import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { authRoutes } from "./auth.routes.js";
import { deviceRoutes } from "./device.routes.js";
import { eventRoutes } from "./event.routes.js";
import { healthRoutes } from "./health.routes.js";
import { routineRoutes } from "./routine.routes.js";

export const apiRouter = Router();

apiRouter.get("/", (_req, res) => {
  res.json({ name: "EcoSense IoT API", health: "/api/health" });
});

apiRouter.use("/health", healthRoutes);
apiRouter.use("/auth", authRoutes);

apiRouter.use("/devices", requireAuth, deviceRoutes);
apiRouter.use("/routines", requireAuth, routineRoutes);
apiRouter.use("/events", requireAuth, eventRoutes);

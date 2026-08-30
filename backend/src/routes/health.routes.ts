import { Router } from "express";
import { prisma } from "../lib/prisma.ts";
import { asyncHandler } from "../utils/asyncHandler.ts";

export const healthRoutes = Router();

/** Liveness + checagem de banco. Usado pelo docker-compose e por monitoramento. */
healthRoutes.get(
  "/",
  asyncHandler(async (_req, res) => {
    let database = "up";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      database = "down";
    }
    res.status(database === "up" ? 200 : 503).json({
      status: database === "up" ? "ok" : "degraded",
      database,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  }),
);

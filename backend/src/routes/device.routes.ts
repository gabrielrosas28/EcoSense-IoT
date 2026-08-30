import { Router } from "express";
import * as controller from "../controllers/device.controller.ts";
import { validate } from "../middlewares/validate.ts";
import { asyncHandler } from "../utils/asyncHandler.ts";
import { commandBody, historyQuery, slugParam, statusBody } from "./schemas.ts";

export const deviceRoutes = Router();

deviceRoutes.get("/", asyncHandler(controller.index));

deviceRoutes.get(
  "/events",
  validate({ query: historyQuery }),
  asyncHandler(controller.history),
);

deviceRoutes.get(
  "/:slug",
  validate({ params: slugParam }),
  asyncHandler(controller.show),
);

// Painel -> dispositivo. Grava o estado e publica no barramento.
deviceRoutes.post(
  "/:slug/command",
  validate({ params: slugParam, body: commandBody }),
  asyncHandler(controller.command),
);

// Dispositivo/simulador -> backend. Só grava o estado reportado.
deviceRoutes.post(
  "/:slug/status",
  validate({ params: slugParam, body: statusBody }),
  asyncHandler(controller.status),
);

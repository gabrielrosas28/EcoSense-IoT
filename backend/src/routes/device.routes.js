import { Router } from "express";
import * as controller from "../controllers/device.controller.js";
import { validate } from "../middlewares/validate.js";
import { commandBody, deviceParams, readingsQuery } from "../schemas/device.schemas.js";

export const deviceRoutes = Router();

deviceRoutes.get("/", controller.list);
deviceRoutes.get("/:id", validate({ params: deviceParams }), controller.show);
deviceRoutes.post("/:id/command", validate({ params: deviceParams, body: commandBody }), controller.command);
deviceRoutes.get("/:id/readings", validate({ params: deviceParams, query: readingsQuery }), controller.readings);

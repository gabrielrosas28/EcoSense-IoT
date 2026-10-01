import { Router } from "express";
import * as controller from "../controllers/event.controller.js";
import { validate } from "../middlewares/validate.js";
import { eventsQuery } from "../schemas/event.schemas.js";

export const eventRoutes = Router();

eventRoutes.get("/", validate({ query: eventsQuery }), controller.list);

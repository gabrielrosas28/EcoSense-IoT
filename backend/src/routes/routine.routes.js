import { Router } from "express";
import * as controller from "../controllers/routine.controller.js";
import { validate } from "../middlewares/validate.js";
import { createRoutineBody, routineParams, updateRoutineBody } from "../schemas/routine.schemas.js";

export const routineRoutes = Router();

routineRoutes.get("/", controller.list);
routineRoutes.post("/", validate({ body: createRoutineBody }), controller.create);
routineRoutes.patch("/:id", validate({ params: routineParams, body: updateRoutineBody }), controller.update);
routineRoutes.delete("/:id", validate({ params: routineParams }), controller.remove);

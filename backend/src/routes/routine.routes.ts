import { Router } from "express";
import * as controller from "../controllers/routine.controller.ts";
import { validate } from "../middlewares/validate.ts";
import { asyncHandler } from "../utils/asyncHandler.ts";
import { idParam, routineBody, routinePatchBody } from "./schemas.ts";

export const routineRoutes = Router();

routineRoutes.get("/", asyncHandler(controller.index));

routineRoutes.post(
  "/",
  validate({ body: routineBody }),
  asyncHandler(controller.create),
);

routineRoutes.patch(
  "/:id",
  validate({ params: idParam, body: routinePatchBody }),
  asyncHandler(controller.update),
);

routineRoutes.delete(
  "/:id",
  validate({ params: idParam }),
  asyncHandler(controller.remove),
);

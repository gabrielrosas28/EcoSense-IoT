import { Router } from "express";
import * as controller from "../controllers/auth.controller.ts";
import { requireAuth } from "../middlewares/auth.ts";
import { validate } from "../middlewares/validate.ts";
import { asyncHandler } from "../utils/asyncHandler.ts";
import { loginBody } from "./schemas.ts";

export const authRoutes = Router();

authRoutes.post("/login", validate({ body: loginBody }), asyncHandler(controller.login));
authRoutes.get("/me", requireAuth, asyncHandler(controller.me));

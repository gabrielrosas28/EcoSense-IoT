import { Router } from "express";
import * as controller from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { loginBody, registerBody } from "../schemas/auth.schemas.js";

export const authRoutes = Router();

authRoutes.post("/login", validate({ body: loginBody }), controller.login);
authRoutes.post("/register", validate({ body: registerBody }), controller.register);
authRoutes.get("/me", requireAuth, controller.me);

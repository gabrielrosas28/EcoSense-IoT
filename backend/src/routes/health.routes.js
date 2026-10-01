import { Router } from "express";
import * as controller from "../controllers/health.controller.js";

export const healthRoutes = Router();

healthRoutes.get("/", controller.show);

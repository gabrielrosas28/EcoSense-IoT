import cors from "cors";
import express, { type Express } from "express";
import { env } from "./config/env.ts";
import { errorHandler } from "./middlewares/errorHandler.ts";
import { notFound } from "./middlewares/notFound.ts";
import { router } from "./routes/index.ts";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  app.use("/api", router);

  // 404 e tratamento de erro ficam por último — nesta ordem.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

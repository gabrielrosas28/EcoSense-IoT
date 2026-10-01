import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config/env.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { notFound } from "./middlewares/notFound.js";
import { requestLogger } from "./middlewares/requestLogger.js";
import { apiRouter } from "./routes/index.js";

/**
 * Monta a aplicação Express sem abrir porta: o `server.js` sobe o HTTP e os
 * testes usam o app direto, via Supertest.
 */
export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: "100kb" }));
  if (!config.isTest) app.use(requestLogger);

  app.use("/api", apiRouter);

  // 404 e tratamento de erro ficam por último, nesta ordem.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

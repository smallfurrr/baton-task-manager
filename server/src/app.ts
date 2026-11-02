import express from "express";
import { errorHandler, notFoundHandler } from "./middleware/error.js";

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  // Routers are mounted under /api as they are added.

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

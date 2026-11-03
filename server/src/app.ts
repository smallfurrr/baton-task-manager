import express from "express";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { createApiRouter } from "./routes/index.js";
import { noopSkillClassifier, type SkillClassifier } from "./services/skillClassifier.js";

export interface AppDependencies {
  /** Suggests skills for tasks created without any. Defaults to tagging nothing. */
  classifier?: SkillClassifier;
}

export function createApp({ classifier = noopSkillClassifier }: AppDependencies = {}): express.Express {
  const app = express();
  app.use(express.json());

  app.use("/api", createApiRouter(classifier));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

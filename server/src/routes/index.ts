import { Router } from "express";
import type { SkillClassifier } from "../services/skillClassifier.js";
import { developersRouter } from "./developers.js";
import { skillsRouter } from "./skills.js";
import { createTasksRouter } from "./tasks.js";

export function createApiRouter(classifier: SkillClassifier): Router {
  const apiRouter = Router();
  apiRouter.use("/skills", skillsRouter);
  apiRouter.use("/developers", developersRouter);
  apiRouter.use("/tasks", createTasksRouter(classifier));
  return apiRouter;
}

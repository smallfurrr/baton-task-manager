import { Router } from "express";
import { developersRouter } from "./developers.js";
import { skillsRouter } from "./skills.js";
import { tasksRouter } from "./tasks.js";

export const apiRouter = Router();

apiRouter.use("/skills", skillsRouter);
apiRouter.use("/developers", developersRouter);
apiRouter.use("/tasks", tasksRouter);

import { Router } from "express";
import { developersRouter } from "./developers.js";
import { skillsRouter } from "./skills.js";

export const apiRouter = Router();

apiRouter.use("/skills", skillsRouter);
apiRouter.use("/developers", developersRouter);

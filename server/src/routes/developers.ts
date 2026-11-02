import { Router } from "express";
import * as developerService from "../services/developerService.js";
import { parseId } from "../validation.js";

export const developersRouter = Router();

developersRouter.get("/", async (_req, res) => {
  res.json(await developerService.listDevelopers());
});

developersRouter.get("/:id", async (req, res) => {
  res.json(await developerService.getDeveloper(parseId(req.params.id, "developer id")));
});

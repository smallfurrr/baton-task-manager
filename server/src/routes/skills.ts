import { Router } from "express";
import * as skillService from "../services/skillService.js";
import { parseId } from "../validation.js";

export const skillsRouter = Router();

skillsRouter.get("/", async (_req, res) => {
  res.json(await skillService.listSkills());
});

skillsRouter.get("/:id", async (req, res) => {
  res.json(await skillService.getSkill(parseId(req.params.id, "skill id")));
});

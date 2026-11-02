import { Router } from "express";
import { z } from "zod";
import * as taskService from "../services/taskService.js";
import { parseBody, parseId, POSTGRES_INT_MAX } from "../validation.js";

export const tasksRouter = Router();

const createTaskSchema = z
  .object({
    title: z
      .string({ error: "title is required and must be a string" })
      .trim()
      .min(1, "title must not be empty")
      .max(500, "title must be at most 500 characters"),
    skillIds: z.array(z.number().int().min(1).max(POSTGRES_INT_MAX)).default([]),
  })
  .strict();

tasksRouter.get("/", async (_req, res) => {
  res.json(await taskService.listTasks());
});

tasksRouter.get("/:id", async (req, res) => {
  res.json(await taskService.getTask(parseId(req.params.id, "task id")));
});

tasksRouter.post("/", async (req, res) => {
  const task = await taskService.createTask(parseBody(createTaskSchema, req.body));
  res.status(201).location(`/api/tasks/${task.id}`).json(task);
});

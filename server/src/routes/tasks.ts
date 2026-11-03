import { Router } from "express";
import { z } from "zod";
import type { SkillClassifier } from "../services/skillClassifier.js";
import { checkTreeLimits } from "../services/taskLimits.js";
import * as taskService from "../services/taskService.js";
import { TASK_STATUSES, type CreateTaskInput } from "../services/taskService.js";
import { idNumberSchema, parseBody, parseId } from "../validation.js";

/** A task to create with its subtasks, to any depth (the depth is capped by `checkTreeLimits`). */
const createTaskSchema: z.ZodType<CreateTaskInput> = z.lazy(() =>
  z
    .object({
      title: z
        .string({ error: "title is required and must be a string" })
        .trim()
        .min(1, "title must not be empty")
        .max(500, "title must be at most 500 characters"),
      skillIds: z.array(idNumberSchema).default([]),
      subtasks: z.array(createTaskSchema).default([]),
    })
    .strict(),
);

const updateTaskSchema = z
  .object({
    status: z.enum(TASK_STATUSES, { error: `status must be one of: ${TASK_STATUSES.join(", ")}` }).optional(),
    assigneeId: idNumberSchema.nullable().optional(),
  })
  .strict()
  .refine((body) => body.status !== undefined || body.assigneeId !== undefined, {
    message: "provide at least one of: status, assigneeId",
  });

export function createTasksRouter(classifier: SkillClassifier): Router {
  const tasksRouter = Router();

  tasksRouter.get("/", async (_req, res) => {
    res.json(await taskService.listTasks());
  });

  tasksRouter.get("/:id", async (req, res) => {
    res.json(await taskService.getTask(parseId(req.params.id, "task id")));
  });

  tasksRouter.post("/", async (req, res) => {
    // Also enforced inside createTask; checking the raw body first keeps schema validation off oversized trees.
    checkTreeLimits(req.body);
    const task = await taskService.createTask(parseBody(createTaskSchema, req.body), classifier);
    res.status(201).location(`/api/tasks/${task.id}`).json(task);
  });

  tasksRouter.patch("/:id", async (req, res) => {
    const id = parseId(req.params.id, "task id");
    res.json(await taskService.updateTask(id, parseBody(updateTaskSchema, req.body)));
  });

  return tasksRouter;
}

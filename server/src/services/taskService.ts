import { getPool, withTransaction } from "../db/pool.js";
import { IncompleteSubtasksError, InvalidReferenceError, NotFoundError, SkillMismatchError } from "../errors.js";
import * as developers from "../repositories/developerRepository.js";
import * as tasks from "../repositories/taskRepository.js";
import { missingSkills } from "./assignment.js";
import { nestTasks, type Task } from "./taskTree.js";

export type { Task };

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** A task to create, with any subtasks to create under it (to any depth). */
export interface CreateTaskInput {
  title: string;
  skillIds: number[];
  subtasks?: CreateTaskInput[];
}

function collectSkillIds(input: CreateTaskInput): number[] {
  return [...input.skillIds, ...(input.subtasks ?? []).flatMap(collectSkillIds)];
}

/** Top-level tasks, newest first, each with its subtasks nested underneath. */
export async function listTasks(): Promise<Task[]> {
  const rows = await tasks.listTasks(getPool());
  const rootIds = rows.filter((row) => row.parentId === null).map((row) => row.id);
  return nestTasks(rows, rootIds);
}

/** One task (top-level or a subtask) with its whole subtree. */
export async function getTask(id: number): Promise<Task> {
  const rows = await tasks.findSubtreeRows(getPool(), id);
  const [task] = nestTasks(rows, [id]);
  if (!task) throw new NotFoundError(`Task ${id} not found`);
  return task;
}

/**
 * Create a task and all its subtasks in one transaction, so a failure anywhere
 * saves nothing. Parents are inserted before their children and siblings in
 * the order given, so ids follow creation order.
 */
export async function createTask(input: CreateTaskInput): Promise<Task> {
  const id = await withTransaction(async (client) => {
    const requested = [...new Set(collectSkillIds(input))];
    const existing = new Set(await tasks.findExistingSkillIds(client, requested));
    const unknown = requested.filter((skillId) => !existing.has(skillId));
    if (unknown.length > 0) {
      throw new InvalidReferenceError(`Unknown skill id(s): ${unknown.join(", ")}`, { skillIds: unknown });
    }

    async function insertTree(node: CreateTaskInput, parentId: number | null): Promise<number> {
      const taskId = await tasks.insertTask(client, node.title, parentId);
      await tasks.insertTaskSkills(client, taskId, [...new Set(node.skillIds)]);
      for (const subtask of node.subtasks ?? []) {
        await insertTree(subtask, taskId);
      }
      return taskId;
    }

    return insertTree(input, null);
  });

  return getTask(id);
}

export interface UpdateTaskInput {
  status?: TaskStatus;
  /** `null` clears the assignee; omitted leaves it unchanged. */
  assigneeId?: number | null;
}

/**
 * Change a task's status and/or assignee in one transaction, so a rejected
 * change leaves the task untouched. Enforces two rules:
 * - the skill rule whenever an assignee is set: the developer must hold every
 *   skill the task requires;
 * - the Done rule: a task can only become Done if every one of its descendants
 *   is already Done.
 */
export async function updateTask(taskId: number, changes: UpdateTaskInput): Promise<Task> {
  await withTransaction(async (client) => {
    const task = await tasks.findTaskById(client, taskId);
    if (!task) throw new NotFoundError(`Task ${taskId} not found`);

    const { assigneeId } = changes;
    if (assigneeId !== undefined && assigneeId !== null) {
      const developer = await developers.findDeveloperById(client, assigneeId);
      if (!developer) throw new InvalidReferenceError(`Developer ${assigneeId} not found`);

      const missing = missingSkills(task.skills, developer.skills);
      if (missing.length > 0) throw new SkillMismatchError(developer.name, missing);
    }

    if (changes.status === "done") {
      const open = await tasks.findOpenDescendants(client, taskId);
      if (open.length > 0) throw new IncompleteSubtasksError(open);
    }

    await tasks.updateTask(client, taskId, changes);
  });

  return getTask(taskId);
}

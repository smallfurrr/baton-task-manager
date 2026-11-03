import { getPool, withTransaction } from "../db/pool.js";
import { IncompleteSubtasksError, InvalidReferenceError, NotFoundError, SkillMismatchError } from "../errors.js";
import * as developers from "../repositories/developerRepository.js";
import * as tasks from "../repositories/taskRepository.js";
import { missingSkills } from "./assignment.js";
import * as skills from "../repositories/skillRepository.js";
import { noopSkillClassifier, type SkillClassifier } from "./skillClassifier.js";
import { CLASSIFIER_CONCURRENCY, mapWithConcurrency, tagSkills } from "./skillTagging.js";
import { checkTreeLimits } from "./taskLimits.js";
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

/** A task ready to save: its skills are final, and `addedByAi` says whether the classifier chose them. */
interface PlannedTask {
  title: string;
  skillIds: number[];
  addedByAi: boolean;
  subtasks: PlannedTask[];
}

function collectSkillIds(task: PlannedTask): number[] {
  return [...task.skillIds, ...task.subtasks.flatMap(collectSkillIds)];
}

function collectUntagged(input: CreateTaskInput): CreateTaskInput[] {
  const own = input.skillIds.length === 0 ? [input] : [];
  return [...own, ...(input.subtasks ?? []).flatMap(collectUntagged)];
}

/**
 * The tree to save, where every task created without skills gets the ones the
 * classifier suggests (and is marked as such). Tasks with user-chosen skills
 * never reach the classifier. Runs before the transaction so a slow LLM call
 * holds no connection or locks.
 */
async function planTasks(input: CreateTaskInput, classifier: SkillClassifier): Promise<PlannedTask> {
  const untagged = collectUntagged(input);
  const known = untagged.length > 0 ? await skills.listSkills(getPool()) : [];

  const suggestions = new Map<CreateTaskInput, number[]>();
  if (known.length > 0) {
    const results = await mapWithConcurrency(untagged, CLASSIFIER_CONCURRENCY, (node) =>
      tagSkills(node.title, known, classifier),
    );
    untagged.forEach((node, i) => suggestions.set(node, results[i] ?? []));
  }

  function plan(node: CreateTaskInput): PlannedTask {
    const suggested = suggestions.get(node);
    return {
      title: node.title,
      skillIds: suggested ?? node.skillIds,
      // Only a task that went to the classifier can have AI-added skills, even if it came back empty.
      addedByAi: suggested !== undefined,
      subtasks: (node.subtasks ?? []).map(plan),
    };
  }
  return plan(input);
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
 * the order given, so ids follow creation order. Tasks given no skills are
 * tagged by the classifier; if it fails they are saved without skills.
 */
export async function createTask(
  rawInput: CreateTaskInput,
  classifier: SkillClassifier = noopSkillClassifier,
): Promise<Task> {
  checkTreeLimits(rawInput);
  const input = await planTasks(rawInput, classifier);

  const id = await withTransaction(async (client) => {
    const requested = [...new Set(collectSkillIds(input))];
    const existing = new Set(await tasks.findExistingSkillIds(client, requested));
    const unknown = requested.filter((skillId) => !existing.has(skillId));
    if (unknown.length > 0) {
      throw new InvalidReferenceError(`Unknown skill id(s): ${unknown.join(", ")}`, { skillIds: unknown });
    }

    async function insertTree(node: PlannedTask, parentId: number | null): Promise<number> {
      const taskId = await tasks.insertTask(client, node.title, parentId);
      await tasks.insertTaskSkills(client, taskId, [...new Set(node.skillIds)], node.addedByAi);
      for (const subtask of node.subtasks) {
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
 * Setting a task to To-do or In progress also reopens its Done ancestors.
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

    // Moving a task out of Done reopens every Done ancestor, so "Done" never
    // sits above unfinished work. Ancestors that are To-do or In progress stay as they are.
    if (changes.status === "todo" || changes.status === "in_progress") {
      await tasks.reopenDoneAncestors(client, taskId);
    }
  });

  return getTask(taskId);
}

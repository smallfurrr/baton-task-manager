/** Anything shaped like a task tree; a `Task` fits. */
interface HasSubtasks {
  subtasks: readonly HasSubtasks[];
}

/** How many tasks sit below this one, at any depth. */
export function countSubtasks(task: HasSubtasks): number {
  return task.subtasks.reduce((total, subtask) => total + 1 + countSubtasks(subtask), 0);
}

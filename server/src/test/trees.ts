/** A task to create, with its subtasks: the shape `POST /api/tasks` and `createTask` take. */
export interface TreeInput {
  title: string;
  skillIds: number[];
  subtasks: TreeInput[];
}

/** A chain `levels` deep: each task has exactly one subtask. Built iteratively, so it can be very deep. */
export function chain(levels: number): TreeInput {
  let node: TreeInput = { title: "leaf", skillIds: [], subtasks: [] };
  for (let level = 1; level < levels; level++) {
    node = { title: `level ${levels - level}`, skillIds: [], subtasks: [node] };
  }
  return node;
}

interface Renderable {
  title: string;
  subtasks: Renderable[];
}

/** Compact view of a task tree: "title(child, child(grandchild))". */
export function renderTree(task: Renderable): string {
  const children = task.subtasks.map(renderTree);
  return children.length ? `${task.title}(${children.join(", ")})` : task.title;
}

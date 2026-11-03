import type { CreateTaskInput, Skill } from "../api/types";

/** Limits that the server also enforces; mirrored here so the form can stop before the server has to. */
const MAX_TITLE_LENGTH = 500;
/** Levels counted from the task itself: task, subtask, sub-subtask. */
export const MAX_DEPTH = 3;
export const MAX_NODES = 100;

/**
 * One task in the creation form: the task itself or one of its subtasks.
 * `key` identifies the node while the form is being edited; it is never sent to the server.
 */
export interface FormNode {
  key: string;
  title: string;
  skillIds: readonly number[];
  subtasks: readonly FormNode[];
}

export interface FormNodePatch {
  title?: string;
  skillIds?: readonly number[];
}

let lastKey = 0;

export function newNode(): FormNode {
  lastKey += 1;
  return { key: `node-${lastKey}`, title: "", skillIds: [], subtasks: [] };
}

/** Apply `change` to the node with `key`, returning a new tree that shares everything unchanged with the old one. */
function mapNode(node: FormNode, key: string, change: (node: FormNode) => FormNode): FormNode {
  if (node.key === key) return change(node);
  let changed = false;
  const subtasks = node.subtasks.map((child) => {
    const next = mapNode(child, key, change);
    if (next !== child) changed = true;
    return next;
  });
  return changed ? { ...node, subtasks } : node;
}

export function updateNode(root: FormNode, key: string, patch: FormNodePatch): FormNode {
  return mapNode(root, key, (node) => ({ ...node, ...patch }));
}

export function countNodes(root: FormNode): number {
  return 1 + root.subtasks.reduce((total, child) => total + countNodes(child), 0);
}

/** True if any task in the tree has no skills ticked, so the server will ask the classifier to suggest them. */
export function hasTaskWithoutSkills(root: FormNode): boolean {
  return root.skillIds.length === 0 || root.subtasks.some(hasTaskWithoutSkills);
}

/** How deep the node sits, with the root task at 1; undefined if the key is not in the tree. */
export function depthOf(root: FormNode, key: string, depth = 1): number | undefined {
  if (root.key === key) return depth;
  for (const child of root.subtasks) {
    const found = depthOf(child, key, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * Why a task at `depth` cannot take another subtask in a form holding `totalNodes` tasks,
 * or undefined if it can. The one place the nesting and size limits are applied.
 */
export function addSubtaskBlockedReason(depth: number, totalNodes: number): string | undefined {
  if (depth >= MAX_DEPTH) return `Subtasks can only be nested ${MAX_DEPTH} levels deep`;
  if (totalNodes >= MAX_NODES) return `A request can create at most ${MAX_NODES} tasks`;
  return undefined;
}

export function canAddSubtask(root: FormNode, parentKey: string): boolean {
  const depth = depthOf(root, parentKey);
  return depth !== undefined && addSubtaskBlockedReason(depth, countNodes(root)) === undefined;
}

/** Add `child` as the last subtask of the node with `parentKey`; unchanged if a limit would be exceeded. */
export function addSubtask(root: FormNode, parentKey: string, child: FormNode = newNode()): FormNode {
  if (!canAddSubtask(root, parentKey)) return root;
  return mapNode(root, parentKey, (node) => ({ ...node, subtasks: [...node.subtasks, child] }));
}

/** Remove a subtask and everything beneath it. The root task cannot be removed. */
export function removeNode(root: FormNode, key: string): FormNode {
  if (root.key === key) return root;
  let changed = false;
  const subtasks = root.subtasks
    .filter((child) => {
      if (child.key === key) changed = true;
      return child.key !== key;
    })
    .map((child) => {
      const next = removeNode(child, key);
      if (next !== child) changed = true;
      return next;
    });
  return changed ? { ...root, subtasks } : root;
}

/** Outline numbers as in the wireframe: the root is "1", its subtasks "1.1", "1.2", theirs "1.1.1", and so on. */
export function numberLabels(root: FormNode): Map<string, string> {
  const labels = new Map<string, string>();
  (function walk(node: FormNode, label: string) {
    labels.set(node.key, label);
    node.subtasks.forEach((child, index) => walk(child, `${label}.${index + 1}`));
  })(root, "1");
  return labels;
}

/** Returns a message describing what is wrong with the title, or undefined if it is fine. */
export function validateTitle(title: string): string | undefined {
  const trimmed = title.trim();
  if (trimmed.length === 0) return "Enter a title for the task.";
  if (trimmed.length > MAX_TITLE_LENGTH) return `The title must be at most ${MAX_TITLE_LENGTH} characters.`;
  return undefined;
}

/** Title problems for every node in the tree, by node key. Empty when the tree can be saved. */
export function validateTree(root: FormNode): Map<string, string> {
  const errors = new Map<string, string>();
  (function walk(node: FormNode) {
    const error = validateTitle(node.title);
    if (error) errors.set(node.key, error);
    node.subtasks.forEach(walk);
  })(root);
  return errors;
}

/** The request body for the whole tree: titles trimmed, skills in the order the form lists them, no keys. */
export function toCreateInput(node: FormNode, skills: readonly Skill[]): CreateTaskInput {
  return {
    title: node.title.trim(),
    skillIds: skills.filter((skill) => node.skillIds.includes(skill.id)).map((skill) => skill.id),
    subtasks: node.subtasks.map((child) => toCreateInput(child, skills)),
  };
}

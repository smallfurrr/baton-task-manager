import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Skill } from "../../../api/types";
import { MAX_DEPTH, MAX_NODES, numberLabels, type FormNode } from "../../../lib/taskFormTree";
import { TaskFormNode } from "./TaskFormNode";

const skills: Skill[] = [
  { id: 1, name: "Frontend" },
  { id: 2, name: "Backend" },
];

function node(key: string, title = "", subtasks: FormNode[] = [], skillIds: number[] = []): FormNode {
  return { key, title, skillIds, subtasks };
}

function renderNode(
  tree: FormNode,
  props: { depth?: number; totalNodes?: number; errors?: Map<string, string>; focusKey?: string } = {},
) {
  const handlers = { onChange: vi.fn(), onAddSubtask: vi.fn(), onRemove: vi.fn() };
  render(
    <TaskFormNode
      node={tree}
      depth={props.depth ?? 1}
      totalNodes={props.totalNodes ?? 1}
      skills={skills}
      labels={numberLabels(tree)}
      errors={props.errors ?? new Map()}
      focusKey={props.focusKey}
      {...handlers}
    />,
  );
  return handlers;
}

const group = (name: string) => screen.getByRole("group", { name });

describe("TaskFormNode", () => {
  it("labels the root task and offers a title, skills and Add subtask, but no Remove", () => {
    renderNode(node("a"));

    const task = within(group("Task 1"));
    expect(task.getByRole("textbox", { name: "Title" })).toBeInTheDocument();
    expect(task.getByRole("checkbox", { name: "Frontend" })).toBeInTheDocument();
    expect(task.getByRole("button", { name: "Add subtask to Task 1" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /^Remove/ })).not.toBeInTheDocument();
  });

  it("labels each subtask by its outline number and gives it a Remove button", () => {
    renderNode(node("a", "", [node("b", "", [node("d")]), node("c")]), { totalNodes: 4 });

    expect(screen.getByRole("group", { name: "Task 1" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Subtask 1.1" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Subtask 1.1.1" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Subtask 1.2" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Remove/ })).toHaveLength(3);
  });

  it("keeps each task's own fields apart from its subtasks' fields", () => {
    renderNode(node("a", "root title", [node("b", "child title")]), { totalNodes: 2 });

    expect(within(group("Task 1")).getByRole("textbox", { name: "Title" })).toHaveValue("root title");
    expect(within(group("Subtask 1.1")).getByRole("textbox", { name: "Title" })).toHaveValue("child title");
  });

  it("reports typing in a subtask's title against that subtask's key", async () => {
    const { onChange } = renderNode(node("a", "", [node("b")]), { totalNodes: 2 });

    await userEvent.type(within(group("Subtask 1.1")).getByRole("textbox", { name: "Title" }), "x");

    expect(onChange).toHaveBeenCalledWith("b", { title: "x" });
  });

  it("reports ticking and unticking a skill with the full new list", async () => {
    const { onChange } = renderNode(node("a", "", [], [1]));
    const task = within(group("Task 1"));

    await userEvent.click(task.getByRole("checkbox", { name: "Backend" }));
    await userEvent.click(task.getByRole("checkbox", { name: "Frontend" }));

    expect(onChange).toHaveBeenNthCalledWith(1, "a", { skillIds: [1, 2] });
    expect(onChange).toHaveBeenNthCalledWith(2, "a", { skillIds: [] });
  });

  it("shows which skills are ticked", () => {
    renderNode(node("a", "", [], [2]));

    expect(screen.getByRole("checkbox", { name: "Backend" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Frontend" })).not.toBeChecked();
  });

  it("reports Add subtask and Remove with the right keys", async () => {
    const { onAddSubtask, onRemove } = renderNode(node("a", "", [node("b")]), { totalNodes: 2 });

    await userEvent.click(screen.getByRole("button", { name: "Add subtask to Subtask 1.1" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove Subtask 1.1" }));

    expect(onAddSubtask).toHaveBeenCalledWith("b");
    expect(onRemove).toHaveBeenCalledWith("b");
  });

  it("shows a node's validation message, linked to its title field", () => {
    renderNode(node("a", "", [node("b")]), { totalNodes: 2, errors: new Map([["b", "Enter a title for the task."]]) });

    const title = within(group("Subtask 1.1")).getByRole("textbox", { name: "Title" });
    expect(title).toBeInvalid();
    expect(title).toHaveAccessibleDescription("Enter a title for the task.");
    expect(within(group("Task 1")).getByRole("textbox", { name: "Title" })).toBeValid();
  });

  it(`disables Add subtask at ${MAX_DEPTH} levels deep, and explains why`, () => {
    renderNode(node("a"), { depth: MAX_DEPTH });

    const add = screen.getByRole("button", { name: /^Add subtask/ });
    expect(add).toBeDisabled();
    expect(add).toHaveAttribute("title", `Subtasks can only be nested ${MAX_DEPTH} levels deep`);
  });

  it(`disables Add subtask once the form holds ${MAX_NODES} tasks`, () => {
    renderNode(node("a"), { totalNodes: MAX_NODES });

    const add = screen.getByRole("button", { name: /^Add subtask/ });
    expect(add).toBeDisabled();
    expect(add).toHaveAttribute("title", `A request can create at most ${MAX_NODES} tasks`);
  });

  it("focuses the title of the node it is told to focus", () => {
    renderNode(node("a", "", [node("b")]), { totalNodes: 2, focusKey: "b" });

    expect(within(group("Subtask 1.1")).getByRole("textbox", { name: "Title" })).toHaveFocus();
  });
});

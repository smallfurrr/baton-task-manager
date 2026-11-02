import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Developer, Skill, Task } from "../../../api/types";
import { TaskTable } from "./TaskTable";

const frontend: Skill = { id: 1, name: "Frontend" };
const backend: Skill = { id: 2, name: "Backend" };

const developers: Developer[] = [
  { id: 1, name: "Alice", skills: [frontend] },
  { id: 2, name: "Bob", skills: [backend] },
  { id: 3, name: "Carol", skills: [frontend, backend] },
  { id: 4, name: "Dave", skills: [backend] },
];

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 10,
    parentId: null,
    title: "Responsive homepage",
    status: "todo",
    skills: [frontend],
    assignee: null,
    subtasks: [],
    createdAt: "2026-11-02T00:00:00.000Z",
    updatedAt: "2026-11-02T00:00:00.000Z",
    ...overrides,
  };
}

function renderTable(tasks: Task[], { pendingTaskId = null as number | null, onUpdate = vi.fn() } = {}) {
  render(<TaskTable tasks={tasks} developers={developers} pendingTaskId={pendingTaskId} onUpdate={onUpdate} />);
  return onUpdate;
}

function optionNames(select: HTMLElement): string[] {
  return within(select)
    .getAllByRole("option")
    .map((option) => option.textContent ?? "");
}

describe("TaskTable", () => {
  it("shows the title, skills, status label and assignee", () => {
    renderTable([makeTask({ skills: [frontend, backend], status: "in_progress", assignee: { id: 3, name: "Carol" } })]);

    const row = screen.getByRole("row", { name: /Responsive homepage/ });
    expect(within(row).getByText("Frontend, Backend")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Status for Responsive homepage" })).toHaveDisplayValue("In progress");
    expect(screen.getByRole("combobox", { name: "Assignee for Responsive homepage" })).toHaveDisplayValue("Carol");
  });

  it("shows None for a task with no skills", () => {
    renderTable([makeTask({ skills: [] })]);

    expect(screen.getByText("None")).toBeInTheDocument();
  });

  it("shows a blank-looking Unassigned choice for an unassigned task", () => {
    renderTable([makeTask()]);

    expect(screen.getByRole("combobox", { name: /Assignee/ })).toHaveDisplayValue("Unassigned");
  });

  it("offers only developers who hold every required skill", () => {
    renderTable([makeTask({ skills: [frontend, backend] })]);

    expect(optionNames(screen.getByRole("combobox", { name: /Assignee/ }))).toEqual(["Unassigned", "Carol"]);
  });

  it("offers everyone for a task with no required skills", () => {
    renderTable([makeTask({ skills: [] })]);

    expect(optionNames(screen.getByRole("combobox", { name: /Assignee/ }))).toEqual([
      "Unassigned",
      "Alice",
      "Bob",
      "Carol",
      "Dave",
    ]);
  });

  it("filters each task's assignee options independently", () => {
    renderTable([
      makeTask({ id: 1, title: "Frontend work", skills: [frontend] }),
      makeTask({ id: 2, title: "Backend work", skills: [backend] }),
    ]);

    expect(optionNames(screen.getByRole("combobox", { name: "Assignee for Frontend work" }))).toEqual([
      "Unassigned",
      "Alice",
      "Carol",
    ]);
    expect(optionNames(screen.getByRole("combobox", { name: "Assignee for Backend work" }))).toEqual([
      "Unassigned",
      "Bob",
      "Carol",
      "Dave",
    ]);
  });

  it("reports a status change", async () => {
    const onUpdate = renderTable([makeTask()]);

    await userEvent.selectOptions(screen.getByRole("combobox", { name: /Status/ }), "Done");

    expect(onUpdate).toHaveBeenCalledWith(10, { status: "done" });
  });

  it("reports an assignment", async () => {
    const onUpdate = renderTable([makeTask()]);

    await userEvent.selectOptions(screen.getByRole("combobox", { name: /Assignee/ }), "Alice");

    expect(onUpdate).toHaveBeenCalledWith(10, { assigneeId: 1 });
  });

  it("reports clearing the assignee as null", async () => {
    const onUpdate = renderTable([makeTask({ assignee: { id: 1, name: "Alice" } })]);

    await userEvent.selectOptions(screen.getByRole("combobox", { name: /Assignee/ }), "Unassigned");

    expect(onUpdate).toHaveBeenCalledWith(10, { assigneeId: null });
  });

  it("disables only the row that is being saved", () => {
    renderTable([makeTask({ id: 1, title: "Saving" }), makeTask({ id: 2, title: "Idle" })], { pendingTaskId: 1 });

    expect(screen.getByRole("combobox", { name: "Status for Saving" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Assignee for Saving" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Status for Idle" })).toBeEnabled();
  });
});

describe("TaskTable: subtasks", () => {
  const nested: Task[] = [
    makeTask({
      id: 1,
      title: "Profile page",
      skills: [frontend, backend],
      subtasks: [
        makeTask({
          id: 2,
          parentId: 1,
          title: "Upload endpoint",
          skills: [backend],
          subtasks: [makeTask({ id: 3, parentId: 2, title: "Resize images", skills: [backend] })],
        }),
        makeTask({ id: 4, parentId: 1, title: "Avatar picker", skills: [frontend] }),
      ],
    }),
    makeTask({ id: 5, title: "Another task" }),
  ];

  const titleCellDepth = (title: string) => {
    const row = screen.getByRole("row", { name: new RegExp(title) });
    return within(row).getAllByRole("cell")[0]!.style.getPropertyValue("--depth");
  };

  function rowTitles(): string[] {
    return screen
      .getAllByRole("row")
      .slice(1) // header
      // The visible "↳" marker is decoration (aria-hidden), so leave it out of the title text.
      .map((row) => (within(row).getAllByRole("cell")[0]!.textContent ?? "").replace("↳", ""));
  }

  it("shows each subtask directly under its parent, to any depth", () => {
    renderTable(nested);

    expect(rowTitles()).toEqual([
      "Profile page",
      "Subtask: Upload endpoint",
      "Subtask: Resize images",
      "Subtask: Avatar picker",
      "Another task",
    ]);
  });

  it("indents by depth and marks subtasks, but not top-level tasks", () => {
    renderTable(nested);

    expect(titleCellDepth("Profile page")).toBe("0");
    expect(titleCellDepth("Upload endpoint")).toBe("1");
    expect(titleCellDepth("Resize images")).toBe("2");
    expect(titleCellDepth("Avatar picker")).toBe("1");
    expect(titleCellDepth("Another task")).toBe("0");
    expect(screen.getAllByText("↳")).toHaveLength(3);
  });

  it("gives every subtask its own status and assignee controls", () => {
    renderTable(nested);

    expect(screen.getByRole("combobox", { name: "Status for Resize images" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Assignee for Resize images" })).toBeInTheDocument();
  });

  it("offers each subtask only the developers qualified for that subtask, not its parent", () => {
    renderTable(nested);

    expect(optionNames(screen.getByRole("combobox", { name: "Assignee for Profile page" }))).toEqual([
      "Unassigned",
      "Carol",
    ]);
    expect(optionNames(screen.getByRole("combobox", { name: "Assignee for Upload endpoint" }))).toEqual([
      "Unassigned",
      "Bob",
      "Carol",
      "Dave",
    ]);
    expect(optionNames(screen.getByRole("combobox", { name: "Assignee for Avatar picker" }))).toEqual([
      "Unassigned",
      "Alice",
      "Carol",
    ]);
  });

  it("reports a change to a subtask using the subtask's own id", async () => {
    const onUpdate = renderTable(nested);

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Status for Resize images" }), "Done");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Assignee for Resize images" }), "Dave");

    expect(onUpdate).toHaveBeenNthCalledWith(1, 3, { status: "done" });
    expect(onUpdate).toHaveBeenNthCalledWith(2, 3, { assigneeId: 4 });
  });

  it("disables only the subtask that is being saved, not its parent or siblings", () => {
    renderTable(nested, { pendingTaskId: 2 });

    expect(screen.getByRole("combobox", { name: "Status for Upload endpoint" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Status for Profile page" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "Status for Avatar picker" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "Status for Resize images" })).toBeEnabled();
  });

  it("renders a deeply nested chain", () => {
    let task = makeTask({ id: 20, title: "level 5" });
    for (let level = 4; level >= 1; level--) {
      task = makeTask({ id: 10 + level, title: `level ${level}`, subtasks: [task] });
    }

    renderTable([task]);

    expect(rowTitles()).toHaveLength(5);
    expect(titleCellDepth("level 5")).toBe("4");
  });
});

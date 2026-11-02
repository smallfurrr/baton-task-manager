import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Developer, Skill, Task } from "../../api/types";
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
    title: "Responsive homepage",
    status: "todo",
    skills: [frontend],
    assignee: null,
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

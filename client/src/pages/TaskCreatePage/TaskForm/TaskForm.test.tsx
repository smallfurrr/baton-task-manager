import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Skill } from "../../../api/types";
import { MAX_DEPTH, MAX_NODES } from "../../../lib/taskFormTree";
import { renderWithProviders } from "../../../test/render";
import { TaskForm } from "./TaskForm";

const skills: Skill[] = [
  { id: 1, name: "Frontend" },
  { id: 2, name: "Backend" },
];

function renderForm(props: Partial<Parameters<typeof TaskForm>[0]> = {}) {
  const onSubmit = vi.fn();
  renderWithProviders(<TaskForm skills={skills} submitting={false} onSubmit={onSubmit} {...props} />);
  return onSubmit;
}

const title = () => screen.getByRole("textbox", { name: "Title" });
const save = () => screen.getByRole("button", { name: "Save" });

describe("TaskForm", () => {
  it("offers a checkbox for each skill, none ticked, and says skills are optional", () => {
    renderForm();

    expect(screen.getByRole("group", { name: "Required skills (optional)" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Frontend" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Backend" })).not.toBeChecked();
  });

  it("says skills are suggested automatically until one is ticked", async () => {
    renderForm();
    const hint = "Leave empty and skills will be suggested automatically.";

    expect(screen.getByText(hint)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "Backend" }));
    expect(screen.queryByText(hint)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "Backend" }));
    expect(screen.getByText(hint)).toBeInTheDocument();
  });

  it("submits a title with no skills and no assignee", async () => {
    const onSubmit = renderForm();

    await userEvent.type(title(), "Write the docs");
    await userEvent.click(save());

    expect(onSubmit).toHaveBeenCalledWith({ title: "Write the docs", skillIds: [], subtasks: [] });
  });

  it("submits the ticked skills", async () => {
    const onSubmit = renderForm();

    await userEvent.type(title(), "Profile page");
    await userEvent.click(screen.getByRole("checkbox", { name: "Backend" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Frontend" }));
    await userEvent.click(save());

    expect(onSubmit).toHaveBeenCalledWith({ title: "Profile page", skillIds: [1, 2], subtasks: [] });
  });

  it("leaves out a skill that was ticked and then unticked", async () => {
    const onSubmit = renderForm();

    await userEvent.type(title(), "Homepage");
    await userEvent.click(screen.getByRole("checkbox", { name: "Frontend" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Frontend" }));
    await userEvent.click(save());

    expect(onSubmit).toHaveBeenCalledWith({ title: "Homepage", skillIds: [], subtasks: [] });
  });

  it("trims the title before submitting", async () => {
    const onSubmit = renderForm();

    await userEvent.type(title(), "   Padded   ");
    await userEvent.click(save());

    expect(onSubmit).toHaveBeenCalledWith({ title: "Padded", skillIds: [], subtasks: [] });
  });

  it("does not show a validation message before the first save attempt", () => {
    renderForm();

    expect(screen.queryByText("Enter a title for the task.")).not.toBeInTheDocument();
  });

  it.each([
    ["empty", ""],
    ["blank", "    "],
  ])("blocks an %s title and explains why", async (_label, text) => {
    const onSubmit = renderForm();

    if (text) await userEvent.type(title(), text);
    await userEvent.click(save());

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a title for the task.")).toBeInTheDocument();
    expect(title()).toBeInvalid();
    expect(title()).toHaveAccessibleDescription("Enter a title for the task.");
  });

  it("blocks a title over 500 characters but accepts exactly 500", async () => {
    const onSubmit = renderForm();

    await userEvent.click(title());
    await userEvent.paste("x".repeat(501));
    await userEvent.click(save());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("The title must be at most 500 characters.")).toBeInTheDocument();

    await userEvent.clear(title());
    await userEvent.paste("x".repeat(500));
    await userEvent.click(save());
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("clears the validation message once the title is fixed", async () => {
    renderForm();
    await userEvent.click(save());
    expect(screen.getByText("Enter a title for the task.")).toBeInTheDocument();

    await userEvent.type(title(), "Now it has a title");

    expect(screen.queryByText("Enter a title for the task.")).not.toBeInTheDocument();
  });

  it("disables saving while a save is in progress", () => {
    renderForm({ submitting: true });

    expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();
  });

  describe("while a save is in progress", () => {
    it("locks the fields and the Add subtask button", () => {
      renderForm({ submitting: true });

      expect(title()).toBeDisabled();
      expect(screen.getByRole("checkbox", { name: "Backend" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Add subtask to Task 1" })).toBeDisabled();
    });

    it("says skills are being suggested when a task has none ticked", () => {
      renderForm({ submitting: true });

      expect(screen.getByRole("status")).toHaveTextContent("Creating task and suggesting skills…");
    });

    it("does not mention suggestions when every task has skills", async () => {
      // Submitting through a real form, so the status appears the way it does in the app.
      function Harness() {
        const [submitting, setSubmitting] = useState(false);
        return <TaskForm skills={skills} submitting={submitting} onSubmit={() => setSubmitting(true)} />;
      }
      renderWithProviders(<Harness />);

      await userEvent.type(title(), "Chosen");
      await userEvent.click(screen.getByRole("checkbox", { name: "Backend" }));
      await userEvent.click(save());

      expect(screen.getByRole("status")).toHaveTextContent(/^Creating task…$/);
    });

    it("blocks the Cancel link", async () => {
      renderForm({ submitting: true });

      expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute("aria-disabled", "true");
    });

    it("shows no progress message when idle", () => {
      renderForm();

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute("aria-disabled", "false");
    });
  });

  it("shows the message from a failed save", () => {
    renderForm({ submitError: "Unknown skill id(s): 9" });

    expect(screen.getByRole("alert")).toHaveTextContent("Unknown skill id(s): 9");
  });

  it("links back to the task list", () => {
    renderForm();

    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", "/");
  });
});

describe("TaskForm: subtasks", () => {
  const group = (name: string) => within(screen.getByRole("group", { name }));
  const addSubtaskTo = (label: string) => userEvent.click(screen.getByRole("button", { name: `Add subtask to ${label}` }));
  const typeTitle = (label: string, text: string) =>
    userEvent.type(group(label).getByRole("textbox", { name: "Title" }), text);

  it("starts with one task that can be given subtasks, and nothing to remove", () => {
    renderForm();

    expect(screen.getByRole("group", { name: "Task 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add subtask to Task 1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Remove/ })).not.toBeInTheDocument();
  });

  it("adds subtasks and nested subtasks as new fields on the same page", async () => {
    renderForm();

    await addSubtaskTo("Task 1");
    await addSubtaskTo("Task 1");
    await addSubtaskTo("Subtask 1.1");

    for (const label of ["Task 1", "Subtask 1.1", "Subtask 1.1.1", "Subtask 1.2"]) {
      expect(screen.getByRole("group", { name: label })).toBeInTheDocument();
    }
  });

  it("moves focus to the title of a newly added subtask", async () => {
    renderForm();

    await addSubtaskTo("Task 1");

    expect(group("Subtask 1.1").getByRole("textbox", { name: "Title" })).toHaveFocus();
  });

  it("removes a subtask with everything beneath it, and renumbers the rest", async () => {
    renderForm();
    await addSubtaskTo("Task 1");
    await addSubtaskTo("Task 1");
    await addSubtaskTo("Subtask 1.1");
    await typeTitle("Subtask 1.2", "keeper");

    await userEvent.click(screen.getByRole("button", { name: "Remove Subtask 1.1" }));

    expect(screen.queryByRole("group", { name: "Subtask 1.1.1" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("group", { name: /Subtask/ })).toHaveLength(1);
    expect(group("Subtask 1.1").getByRole("textbox", { name: "Title" })).toHaveValue("keeper");
  });

  it("keeps what was typed in other tasks when one is added or removed", async () => {
    renderForm();
    await typeTitle("Task 1", "root");
    await addSubtaskTo("Task 1");
    await typeTitle("Subtask 1.1", "first");
    await addSubtaskTo("Task 1");
    await typeTitle("Subtask 1.2", "second");

    await userEvent.click(screen.getByRole("button", { name: "Remove Subtask 1.1" }));

    expect(group("Task 1").getByRole("textbox", { name: "Title" })).toHaveValue("root");
    expect(group("Subtask 1.1").getByRole("textbox", { name: "Title" })).toHaveValue("second");
  });

  it("gives each task its own skills", async () => {
    renderForm();
    await addSubtaskTo("Task 1");

    await userEvent.click(group("Task 1").getByRole("checkbox", { name: "Frontend" }));
    await userEvent.click(group("Subtask 1.1").getByRole("checkbox", { name: "Backend" }));

    expect(group("Task 1").getByRole("checkbox", { name: "Frontend" })).toBeChecked();
    expect(group("Task 1").getByRole("checkbox", { name: "Backend" })).not.toBeChecked();
    expect(group("Subtask 1.1").getByRole("checkbox", { name: "Frontend" })).not.toBeChecked();
    expect(group("Subtask 1.1").getByRole("checkbox", { name: "Backend" })).toBeChecked();
  });

  it("submits the whole tree in one nested payload", async () => {
    const onSubmit = renderForm();
    await typeTitle("Task 1", "Profile page");
    await userEvent.click(group("Task 1").getByRole("checkbox", { name: "Frontend" }));
    await addSubtaskTo("Task 1");
    await typeTitle("Subtask 1.1", "Upload endpoint");
    await userEvent.click(group("Subtask 1.1").getByRole("checkbox", { name: "Backend" }));
    await addSubtaskTo("Subtask 1.1");
    await typeTitle("Subtask 1.1.1", "  Resize images  ");
    await addSubtaskTo("Task 1");
    await typeTitle("Subtask 1.2", "Avatar picker");

    await userEvent.click(save());

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      title: "Profile page",
      skillIds: [1],
      subtasks: [
        {
          title: "Upload endpoint",
          skillIds: [2],
          subtasks: [{ title: "Resize images", skillIds: [], subtasks: [] }],
        },
        { title: "Avatar picker", skillIds: [], subtasks: [] },
      ],
    });
  });

  it("blocks saving while a subtask has no title, pointing at that subtask only", async () => {
    const onSubmit = renderForm();
    await typeTitle("Task 1", "Root");
    await addSubtaskTo("Task 1");
    await addSubtaskTo("Task 1");
    await typeTitle("Subtask 1.2", "Fine");

    await userEvent.click(save());

    expect(onSubmit).not.toHaveBeenCalled();
    expect(group("Subtask 1.1").getByRole("textbox", { name: "Title" })).toBeInvalid();
    expect(group("Task 1").getByRole("textbox", { name: "Title" })).toBeValid();
    expect(group("Subtask 1.2").getByRole("textbox", { name: "Title" })).toBeValid();
    expect(screen.getAllByText("Enter a title for the task.")).toHaveLength(1);
  });

  it("lets the user save once the missing subtask title is filled in", async () => {
    const onSubmit = renderForm();
    await typeTitle("Task 1", "Root");
    await addSubtaskTo("Task 1");
    await userEvent.click(save());
    expect(onSubmit).not.toHaveBeenCalled();

    await typeTitle("Subtask 1.1", "Now named");
    await userEvent.click(save());

    expect(onSubmit).toHaveBeenCalledWith({
      title: "Root",
      skillIds: [],
      subtasks: [{ title: "Now named", skillIds: [], subtasks: [] }],
    });
  });

  it("lets the user save after removing a subtask that was left blank", async () => {
    const onSubmit = renderForm();
    await typeTitle("Task 1", "Root");
    await addSubtaskTo("Task 1");
    await userEvent.click(save());
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Remove Subtask 1.1" }));
    await userEvent.click(save());

    expect(onSubmit).toHaveBeenCalledWith({ title: "Root", skillIds: [], subtasks: [] });
  });

  it(`stops adding subtasks at ${MAX_DEPTH} levels deep`, async () => {
    renderForm();
    let label = "Task 1";
    for (let level = 1; level < MAX_DEPTH; level++) {
      await addSubtaskTo(label);
      label = `Subtask ${"1.".repeat(level)}1`.replace(/\.$/, "");
    }

    expect(screen.getByRole("button", { name: `Add subtask to ${label}` })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add subtask to Task 1" })).toBeEnabled();
  });

  // Clicks "Add subtask" about 100 times and re-renders a growing tree each time: about 2.5 s on a
  // laptop but over the 5 s default on a slow CI runner, so it gets a longer limit of its own.
  it(`stops adding subtasks once the form holds ${MAX_NODES} tasks`, { timeout: 30_000 }, async () => {
    const user = userEvent.setup({ delay: null });
    renderForm();

    for (let added = 1; added < MAX_NODES; added++) {
      await user.click(screen.getByRole("button", { name: "Add subtask to Task 1" }));
    }

    expect(screen.getAllByRole("group", { name: /^(Task|Subtask) / })).toHaveLength(MAX_NODES);
    expect(screen.getByRole("button", { name: "Add subtask to Task 1" })).toBeDisabled();
  });
});

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Skill } from "../../../api/types";
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

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
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

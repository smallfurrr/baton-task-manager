import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "./App";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("App", () => {
  it("shows the task list page at /", () => {
    renderAt("/");

    expect(screen.getByRole("heading", { name: "Tasks" })).toBeInTheDocument();
  });

  it("navigates to the create task page from the nav", async () => {
    renderAt("/");

    await userEvent.click(screen.getByRole("link", { name: "Create task" }));

    expect(screen.getByRole("heading", { name: "Create Task" })).toBeInTheDocument();
  });

  it("marks the current page's nav link as active", async () => {
    renderAt("/");
    const tasksLink = screen.getByRole("link", { name: "Tasks" });
    const createLink = screen.getByRole("link", { name: "Create task" });
    expect(tasksLink).toHaveAttribute("aria-current", "page");
    expect(createLink).not.toHaveAttribute("aria-current");

    await userEvent.click(createLink);

    expect(createLink).toHaveAttribute("aria-current", "page");
    expect(tasksLink).not.toHaveAttribute("aria-current");
  });

  it("shows a not-found message for an unknown route", () => {
    renderAt("/nope");

    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });
});

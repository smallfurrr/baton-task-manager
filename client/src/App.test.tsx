import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";
import { jsonResponse, mockApi } from "./test/fetch";
import { renderWithProviders } from "./test/render";

/** The nav link, as opposed to the page's own "Create task" button. */
function navLink(name: string): HTMLElement {
  return within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name });
}

function renderAt(path: string) {
  return renderWithProviders(<App />, path);
}

beforeEach(() => {
  mockApi({ "GET /api/tasks": jsonResponse([]), "GET /api/developers": jsonResponse([]) });
});

describe("App", () => {
  it("shows the task list page at /", () => {
    renderAt("/");

    expect(screen.getByRole("heading", { name: "Tasks" })).toBeInTheDocument();
    expect(screen.getByText("Loading tasks…")).toBeInTheDocument();
  });

  it("navigates to the create task page from the nav", async () => {
    renderAt("/");

    await userEvent.click(navLink("Create task"));

    expect(screen.getByRole("heading", { name: "Create Task" })).toBeInTheDocument();
  });

  it("marks the current page's nav link as active", async () => {
    renderAt("/");
    const tasksLink = navLink("Tasks");
    const createLink = navLink("Create task");
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

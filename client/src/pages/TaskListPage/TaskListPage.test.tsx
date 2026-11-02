import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Developer, Skill, Task } from "../../api/types";
import { jsonResponse, mockApi } from "../../test/fetch";
import { renderWithProviders } from "../../test/render";
import { TaskListPage } from "./TaskListPage";

const frontend: Skill = { id: 1, name: "Frontend" };
const backend: Skill = { id: 2, name: "Backend" };

const developers: Developer[] = [
  { id: 1, name: "Alice", skills: [frontend] },
  { id: 3, name: "Carol", skills: [frontend, backend] },
];

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 10,
    title: "Profile page",
    status: "todo",
    skills: [frontend, backend],
    assignee: null,
    createdAt: "2026-11-02T00:00:00.000Z",
    updatedAt: "2026-11-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("TaskListPage", () => {
  it("shows a loading message, then the tasks", async () => {
    mockApi({
      "GET /api/tasks": jsonResponse([makeTask()]),
      "GET /api/developers": jsonResponse(developers),
    });

    renderWithProviders(<TaskListPage />);

    expect(screen.getByText("Loading tasks…")).toBeInTheDocument();
    expect(await screen.findByText("Profile page")).toBeInTheDocument();
  });

  it("shows an empty state with a link to create the first task", async () => {
    mockApi({ "GET /api/tasks": jsonResponse([]), "GET /api/developers": jsonResponse(developers) });

    renderWithProviders(<TaskListPage />);

    expect(await screen.findByText(/No tasks yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create the first one" })).toHaveAttribute("href", "/tasks/new");
  });

  it("shows an error when the tasks cannot be loaded", async () => {
    mockApi({
      "GET /api/tasks": jsonResponse({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } }, 500),
      "GET /api/developers": jsonResponse(developers),
    });

    renderWithProviders(<TaskListPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load tasks: Internal server error");
  });

  it("has a Create task link", async () => {
    mockApi({ "GET /api/tasks": jsonResponse([]), "GET /api/developers": jsonResponse(developers) });

    renderWithProviders(<TaskListPage />);

    expect(await screen.findByRole("link", { name: "Create task" })).toHaveAttribute("href", "/tasks/new");
  });

  it("shows the notice passed from another page", async () => {
    mockApi({ "GET /api/tasks": jsonResponse([]), "GET /api/developers": jsonResponse(developers) });

    renderWithProviders(<TaskListPage />, { pathname: "/", state: { notice: "Task created" } });

    expect(await screen.findByRole("status")).toHaveTextContent("Task created");
  });

  it("saves a status change and shows the refreshed list", async () => {
    let task = makeTask();
    const fetchMock = mockApi({
      "GET /api/tasks": () => jsonResponse([task]),
      "GET /api/developers": jsonResponse(developers),
      "PATCH /api/tasks/10": (body) => {
        task = { ...task, ...(body as Partial<Task>) };
        return jsonResponse(task);
      },
    });
    renderWithProviders(<TaskListPage />);

    await userEvent.selectOptions(await screen.findByRole("combobox", { name: /Status/ }), "Done");

    await waitFor(() => expect(screen.getByRole("combobox", { name: /Status/ })).toHaveDisplayValue("Done"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tasks/10",
      expect.objectContaining({ method: "PATCH", body: '{"status":"done"}' }),
    );
  });

  it("assigns an eligible developer and shows them as the assignee", async () => {
    let task = makeTask();
    mockApi({
      "GET /api/tasks": () => jsonResponse([task]),
      "GET /api/developers": jsonResponse(developers),
      "PATCH /api/tasks/10": () => {
        task = { ...task, assignee: { id: 3, name: "Carol" } };
        return jsonResponse(task);
      },
    });
    renderWithProviders(<TaskListPage />);

    await userEvent.selectOptions(await screen.findByRole("combobox", { name: /Assignee/ }), "Carol");

    await waitFor(() => expect(screen.getByRole("combobox", { name: /Assignee/ })).toHaveDisplayValue("Carol"));
  });

  it("shows the server's message and keeps the old value when a change is rejected", async () => {
    mockApi({
      "GET /api/tasks": jsonResponse([makeTask()]),
      "GET /api/developers": jsonResponse(developers),
      "PATCH /api/tasks/10": jsonResponse(
        { error: { code: "SKILL_MISMATCH", message: "Carol cannot be assigned: missing required skill(s) X" } },
        409,
      ),
    });
    renderWithProviders(<TaskListPage />);

    await userEvent.selectOptions(await screen.findByRole("combobox", { name: /Assignee/ }), "Carol");

    expect(await screen.findByRole("alert")).toHaveTextContent("Carol cannot be assigned");
    expect(screen.getByRole("combobox", { name: /Assignee/ })).toHaveDisplayValue("Unassigned");
  });
});

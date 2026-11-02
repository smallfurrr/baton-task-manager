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
    parentId: null,
    title: "Profile page",
    status: "todo",
    skills: [frontend, backend],
    assignee: null,
    subtasks: [],
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

describe("TaskListPage: subtasks", () => {
  const parent = (overrides: Partial<Task> = {}): Task =>
    makeTask({
      id: 10,
      title: "Profile page",
      subtasks: [makeTask({ id: 11, parentId: 10, title: "Upload endpoint", skills: [backend] })],
      ...overrides,
    });

  it("shows subtasks nested under their parents", async () => {
    mockApi({
      "GET /api/tasks": jsonResponse([parent()]),
      "GET /api/developers": jsonResponse(developers),
    });

    renderWithProviders(<TaskListPage />);

    expect(await screen.findByText("Profile page")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Status for Upload endpoint" })).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3); // header + parent + subtask
  });

  it("saves a subtask's status to the subtask's own endpoint", async () => {
    let tasks = [parent()];
    const fetchMock = mockApi({
      "GET /api/tasks": () => jsonResponse(tasks),
      "GET /api/developers": jsonResponse(developers),
      "PATCH /api/tasks/11": () => {
        tasks = [parent({ subtasks: [{ ...tasks[0]!.subtasks[0]!, status: "done" }] })];
        return jsonResponse(tasks[0]!.subtasks[0]);
      },
    });
    renderWithProviders(<TaskListPage />);

    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Status for Upload endpoint" }), "Done");

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Status for Upload endpoint" })).toHaveDisplayValue("Done"),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tasks/11",
      expect.objectContaining({ method: "PATCH", body: '{"status":"done"}' }),
    );
  });

  it("shows the server's message and keeps the old value when a task cannot be marked Done yet", async () => {
    mockApi({
      "GET /api/tasks": jsonResponse([parent()]),
      "GET /api/developers": jsonResponse(developers),
      "PATCH /api/tasks/10": jsonResponse(
        {
          error: {
            code: "INCOMPLETE_SUBTASKS",
            message: "Cannot mark task Done: 1 subtask(s) are not Done (Upload endpoint)",
          },
        },
        409,
      ),
    });
    renderWithProviders(<TaskListPage />);

    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Status for Profile page" }), "Done");

    expect(await screen.findByRole("alert")).toHaveTextContent("1 subtask(s) are not Done (Upload endpoint)");
    expect(screen.getByRole("combobox", { name: "Status for Profile page" })).toHaveDisplayValue("To-do");
  });

  it("shows a parent that the server reopened after a subtask was moved out of Done", async () => {
    let tasks = [
      parent({ status: "done", subtasks: [makeTask({ id: 11, parentId: 10, title: "Upload endpoint", status: "done" })] }),
    ];
    mockApi({
      "GET /api/tasks": () => jsonResponse(tasks),
      "GET /api/developers": jsonResponse(developers),
      "PATCH /api/tasks/11": () => {
        // The server reopens the Done parent as part of this change.
        tasks = [parent({ status: "in_progress", subtasks: [{ ...tasks[0]!.subtasks[0]!, status: "in_progress" }] })];
        return jsonResponse(tasks[0]!.subtasks[0]);
      },
    });
    renderWithProviders(<TaskListPage />);
    expect(await screen.findByRole("combobox", { name: "Status for Profile page" })).toHaveDisplayValue("Done");

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Status for Upload endpoint" }), "In progress");

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Status for Profile page" })).toHaveDisplayValue("In progress"),
    );
  });
});

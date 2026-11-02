import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../../App";
import type { Skill, Task } from "../../api/types";
import { jsonResponse, mockApi } from "../../test/fetch";
import { renderWithProviders } from "../../test/render";

const skills: Skill[] = [
  { id: 1, name: "Frontend" },
  { id: 2, name: "Backend" },
];

const createdTask: Task = {
  id: 5,
  parentId: null,
  title: "Profile page",
  status: "todo",
  skills,
  assignee: null,
  subtasks: [],
  createdAt: "2026-11-02T00:00:00.000Z",
  updatedAt: "2026-11-02T00:00:00.000Z",
};

describe("task creation flow", () => {
  it("saves the task, returns to the list with a notice, and shows the new task", async () => {
    let tasks: Task[] = [];
    const fetchMock = mockApi({
      "GET /api/skills": jsonResponse(skills),
      "GET /api/developers": jsonResponse([]),
      "GET /api/tasks": () => jsonResponse(tasks),
      "POST /api/tasks": () => {
        tasks = [createdTask];
        return jsonResponse(createdTask, 201);
      },
    });
    renderWithProviders(<App />, "/tasks/new");

    await userEvent.type(await screen.findByRole("textbox", { name: "Title" }), "Profile page");
    await userEvent.click(screen.getByRole("checkbox", { name: "Frontend" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Backend" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Task created");
    expect(await screen.findByRole("row", { name: /Profile page/ })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tasks",
      expect.objectContaining({ method: "POST", body: '{"title":"Profile page","skillIds":[1,2],"subtasks":[]}' }),
    );
  });

  it("saves a task with nested subtasks in one request and shows them nested on the list", async () => {
    const nested: Task = {
      ...createdTask,
      title: "Profile page",
      skills: [skills[0]!],
      subtasks: [
        {
          ...createdTask,
          id: 6,
          parentId: 5,
          title: "Upload endpoint",
          skills: [skills[1]!],
          subtasks: [{ ...createdTask, id: 7, parentId: 6, title: "Resize images", skills: [] }],
        },
      ],
    };
    let tasks: Task[] = [];
    const fetchMock = mockApi({
      "GET /api/skills": jsonResponse(skills),
      "GET /api/developers": jsonResponse([]),
      "GET /api/tasks": () => jsonResponse(tasks),
      "POST /api/tasks": () => {
        tasks = [nested];
        return jsonResponse(nested, 201);
      },
    });
    renderWithProviders(<App />, "/tasks/new");

    const title = (label: string) => within(screen.getByRole("group", { name: label })).getByRole("textbox", { name: "Title" });
    await userEvent.type(await screen.findByRole("textbox", { name: "Title" }), "Profile page");
    await userEvent.click(within(screen.getByRole("group", { name: "Task 1" })).getByRole("checkbox", { name: "Frontend" }));
    await userEvent.click(screen.getByRole("button", { name: "Add subtask to Task 1" }));
    await userEvent.type(title("Subtask 1.1"), "Upload endpoint");
    await userEvent.click(within(screen.getByRole("group", { name: "Subtask 1.1" })).getByRole("checkbox", { name: "Backend" }));
    await userEvent.click(screen.getByRole("button", { name: "Add subtask to Subtask 1.1" }));
    await userEvent.type(title("Subtask 1.1.1"), "Resize images");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Task created");
    expect(await screen.findByText("Resize images")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(4); // header + 3 tasks
    expect(JSON.parse(fetchMock.mock.calls.find(([, init]) => init?.method === "POST")![1]!.body!)).toEqual({
      title: "Profile page",
      skillIds: [1],
      subtasks: [
        {
          title: "Upload endpoint",
          skillIds: [2],
          subtasks: [{ title: "Resize images", skillIds: [], subtasks: [] }],
        },
      ],
    });
  });

  it("creates a task with no skills", async () => {
    const fetchMock = mockApi({
      "GET /api/skills": jsonResponse(skills),
      "GET /api/developers": jsonResponse([]),
      "GET /api/tasks": jsonResponse([]),
      "POST /api/tasks": jsonResponse({ ...createdTask, skills: [] }, 201),
    });
    renderWithProviders(<App />, "/tasks/new");

    await userEvent.type(await screen.findByRole("textbox", { name: "Title" }), "No skills yet");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Task created");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tasks",
      expect.objectContaining({ body: '{"title":"No skills yet","skillIds":[],"subtasks":[]}' }),
    );
  });

  it("stays on the form, with the input kept, when the server rejects the task", async () => {
    mockApi({
      "GET /api/skills": jsonResponse(skills),
      "POST /api/tasks": jsonResponse({ error: { code: "INVALID_REFERENCE", message: "Unknown skill id(s): 1" } }, 422),
    });
    renderWithProviders(<App />, "/tasks/new");

    await userEvent.type(await screen.findByRole("textbox", { name: "Title" }), "Keep me");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Unknown skill id(s): 1");
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Keep me");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("does not call the API when the title is empty", async () => {
    const fetchMock = mockApi({ "GET /api/skills": jsonResponse(skills) });
    renderWithProviders(<App />, "/tasks/new");

    await userEvent.click(await screen.findByRole("button", { name: "Save" }));

    expect(screen.getByText("Enter a title for the task.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1); // only the skills load
  });

  it("explains when the skills cannot be loaded", async () => {
    mockApi({
      "GET /api/skills": jsonResponse({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } }, 500),
    });
    renderWithProviders(<App />, "/tasks/new");

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load skills: Internal server error");
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });
});

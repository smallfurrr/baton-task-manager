import { describe, expect, it } from "vitest";
import { jsonResponse, mockFetch } from "../test/fetch";
import { createTask, fetchTasks, updateTask } from "./tasks";

describe("task api", () => {
  it("fetches the task list", async () => {
    const fetchMock = mockFetch(jsonResponse([]));

    await expect(fetchTasks()).resolves.toEqual([]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/tasks");
  });

  it("creates a task with a POST of the title and skill ids", async () => {
    const fetchMock = mockFetch(jsonResponse({ id: 1 }, 201));

    await createTask({ title: "Homepage", skillIds: [1, 2] });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/tasks");
    expect(init).toMatchObject({ method: "POST", body: '{"title":"Homepage","skillIds":[1,2]}' });
  });

  it("updates a task with a PATCH to its id", async () => {
    const fetchMock = mockFetch(jsonResponse({ id: 7 }));

    await updateTask(7, { status: "done" });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/tasks/7");
    expect(init).toMatchObject({ method: "PATCH", body: '{"status":"done"}' });
  });

  it("can send a null assignee to unassign", async () => {
    const fetchMock = mockFetch(jsonResponse({ id: 7 }));

    await updateTask(7, { assigneeId: null });

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ body: '{"assigneeId":null}' });
  });
});

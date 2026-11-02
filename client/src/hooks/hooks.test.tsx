import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import type { Task } from "../api/types";
import { jsonResponse, mockFetch } from "../test/fetch";
import { useDevelopers } from "./developers";
import { useSkills } from "./skills";
import { useCreateTask, useTasks, useUpdateTask } from "./tasks";

const task: Task = {
  id: 1,
  parentId: null,
  title: "Homepage",
  status: "todo",
  skills: [],
  assignee: null,
  subtasks: [],
  createdAt: "2026-11-02T00:00:00.000Z",
  updatedAt: "2026-11-02T00:00:00.000Z",
};

function wrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("query hooks", () => {
  it("useTasks loads the task list", async () => {
    mockFetch(jsonResponse([task]));

    const { result } = renderHook(() => useTasks(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.data).toEqual([task]));
  });

  it("useDevelopers loads developers", async () => {
    const developers = [{ id: 1, name: "Alice", skills: [{ id: 1, name: "Frontend" }] }];
    mockFetch(jsonResponse(developers));

    const { result } = renderHook(() => useDevelopers(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.data).toEqual(developers));
  });

  it("useSkills loads skills", async () => {
    mockFetch(jsonResponse([{ id: 1, name: "Frontend" }]));

    const { result } = renderHook(() => useSkills(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.data).toEqual([{ id: 1, name: "Frontend" }]));
  });

  it("surfaces an API failure as an error", async () => {
    mockFetch(jsonResponse({ error: { code: "INTERNAL_ERROR", message: "boom" } }, 500));

    const { result } = renderHook(() => useTasks(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.error).toMatchObject({ code: "INTERNAL_ERROR" }));
  });
});

describe("mutation hooks", () => {
  it("useCreateTask refetches the task list after creating", async () => {
    const created = { ...task, id: 2, title: "New" };
    const fetchMock = mockFetch(
      jsonResponse([task]), // initial list
      jsonResponse(created, 201), // POST
      jsonResponse([created, task]), // refetch
    );
    const { result } = renderHook(() => ({ tasks: useTasks(), create: useCreateTask() }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.tasks.data).toEqual([task]));

    await act(() => result.current.create.mutateAsync({ title: "New", skillIds: [], subtasks: [] }));

    await waitFor(() => expect(result.current.tasks.data).toEqual([created, task]));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("useUpdateTask refetches the task list after updating", async () => {
    const updated = { ...task, status: "done" as const };
    const fetchMock = mockFetch(jsonResponse([task]), jsonResponse(updated), jsonResponse([updated]));
    const { result } = renderHook(() => ({ tasks: useTasks(), update: useUpdateTask() }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.tasks.data).toEqual([task]));

    await act(() => result.current.update.mutateAsync({ id: 1, changes: { status: "done" } }));

    await waitFor(() => expect(result.current.tasks.data).toEqual([updated]));
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/tasks/1");
  });

  it("useUpdateTask exposes the ApiError when the server rejects the change", async () => {
    mockFetch(
      jsonResponse([task]),
      jsonResponse({ error: { code: "SKILL_MISMATCH", message: "Alice cannot be assigned" } }, 409),
    );
    const { result } = renderHook(() => ({ tasks: useTasks(), update: useUpdateTask() }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.tasks.data).toBeDefined());

    await act(() => result.current.update.mutateAsync({ id: 1, changes: { assigneeId: 1 } }).catch(() => undefined));

    await waitFor(() =>
      expect(result.current.update.error).toMatchObject({ status: 409, code: "SKILL_MISMATCH" }),
    );
  });
});

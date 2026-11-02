import { request } from "./client";
import type { CreateTaskInput, Task, UpdateTaskInput } from "./types";

export const fetchTasks = () => request<Task[]>("/tasks");

export const createTask = (input: CreateTaskInput) => request<Task>("/tasks", { method: "POST", body: input });

export const updateTask = (id: number, changes: UpdateTaskInput) =>
  request<Task>(`/tasks/${id}`, { method: "PATCH", body: changes });

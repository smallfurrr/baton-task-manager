import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createTask, fetchTasks, updateTask } from "../api/tasks";
import type { CreateTaskInput, UpdateTaskInput } from "../api/types";

export const tasksKey = ["tasks"] as const;

export const useTasks = () => useQuery({ queryKey: tasksKey, queryFn: fetchTasks });

/** Create a task, then refetch the task list so it shows up. */
export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksKey }),
  });
}

/** Change a task's status and/or assignee, then refetch the task list. */
export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: UpdateTaskInput }) => updateTask(id, changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksKey }),
  });
}

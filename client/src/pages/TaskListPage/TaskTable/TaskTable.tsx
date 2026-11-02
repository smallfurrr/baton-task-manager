import { Fragment } from "react";
import type { Developer, Task, UpdateTaskInput } from "../../../api/types";
import { TaskRow } from "./TaskRow";
import styles from "./TaskTable.module.css";

interface TaskTableProps {
  tasks: readonly Task[];
  developers: readonly Developer[];
  /** Id of the task currently being saved, if any. */
  pendingTaskId: number | null;
  onUpdate: (taskId: number, changes: UpdateTaskInput) => void;
}

type RowsProps = Omit<TaskTableProps, "tasks"> & { tasks: readonly Task[]; depth: number };

/** A row for each task, each followed by the rows for its subtasks, one level deeper. */
function TaskRows({ tasks, depth, developers, pendingTaskId, onUpdate }: RowsProps) {
  return tasks.map((task) => (
    <Fragment key={task.id}>
      <TaskRow
        task={task}
        depth={depth}
        developers={developers}
        pending={task.id === pendingTaskId}
        onUpdate={onUpdate}
      />
      <TaskRows
        tasks={task.subtasks}
        depth={depth + 1}
        developers={developers}
        pendingTaskId={pendingTaskId}
        onUpdate={onUpdate}
      />
    </Fragment>
  ));
}

export function TaskTable({ tasks, developers, pendingTaskId, onUpdate }: TaskTableProps) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">Task Title</th>
          <th scope="col">Skills</th>
          <th scope="col">Status</th>
          <th scope="col">Assignee</th>
        </tr>
      </thead>
      <tbody>
        <TaskRows
          tasks={tasks}
          depth={0}
          developers={developers}
          pendingTaskId={pendingTaskId}
          onUpdate={onUpdate}
        />
      </tbody>
    </table>
  );
}

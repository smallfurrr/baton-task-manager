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
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            developers={developers}
            pending={task.id === pendingTaskId}
            onUpdate={onUpdate}
          />
        ))}
      </tbody>
    </table>
  );
}

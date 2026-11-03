import { Fragment, useState } from "react";
import type { Developer, Task, UpdateTaskInput } from "../../../api/types";
import { countSubtasks } from "../../../lib/countSubtasks";
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

/** Empty space between two cards. Hidden from assistive tech: it is not a task. */
function GroupGap() {
  return (
    <tbody className={styles.gap} aria-hidden="true">
      <tr>
        <td colSpan={4} />
      </tr>
    </tbody>
  );
}

export function TaskTable({ tasks, developers, pendingTaskId, onUpdate }: TaskTableProps) {
  // Ids of top-level tasks whose subtasks are hidden. Everything starts expanded; nothing is remembered across reloads.
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(new Set());

  function toggle(taskId: number) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(taskId)) next.add(taskId);
      return next;
    });
  }

  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Task Title</th>
            <th scope="col">Skills</th>
            <th scope="col">Status</th>
            <th scope="col">Assignee</th>
          </tr>
        </thead>
        {/* One <tbody> per top-level task, drawn as a card with its subtasks inside it. */}
        {tasks.map((task, index) => (
          <Fragment key={task.id}>
            {index > 0 && <GroupGap />}
            <tbody className={styles.group}>
              <TaskRow
                task={task}
                depth={0}
                developers={developers}
                pending={task.id === pendingTaskId}
                collapse={
                  task.subtasks.length > 0
                    ? {
                        subtaskCount: countSubtasks(task),
                        expanded: !collapsed.has(task.id),
                        onToggle: () => toggle(task.id),
                      }
                    : undefined
                }
                onUpdate={onUpdate}
              />
              {!collapsed.has(task.id) && (
                <TaskRows
                  tasks={task.subtasks}
                  depth={1}
                  developers={developers}
                  pendingTaskId={pendingTaskId}
                  onUpdate={onUpdate}
                />
              )}
            </tbody>
          </Fragment>
        ))}
      </table>
    </div>
  );
}

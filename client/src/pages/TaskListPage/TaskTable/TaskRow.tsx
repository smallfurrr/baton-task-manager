import type { CSSProperties } from "react";
import type { Developer, Task, UpdateTaskInput } from "../../../api/types";
import { eligibleDevelopers } from "../../../lib/eligibleDevelopers";
import { AssigneeSelect } from "../AssigneeSelect/AssigneeSelect";
import { StatusSelect } from "../StatusSelect/StatusSelect";
import styles from "./TaskRow.module.css";

interface TaskRowProps {
  task: Task;
  /** How many levels below a top-level task this row sits: 0 for top-level. */
  depth: number;
  developers: readonly Developer[];
  /** True while a change to this task is being saved. */
  pending: boolean;
  onUpdate: (taskId: number, changes: UpdateTaskInput) => void;
}

export function TaskRow({ task, depth, developers, pending, onUpdate }: TaskRowProps) {
  return (
    <tr>
      {/* TaskTable.module.css reads --depth to indent the title; React's style type does not know custom properties. */}
      <td style={{ "--depth": depth } as CSSProperties}>
        {depth > 0 && (
          <>
            <span className={styles.marker} aria-hidden="true">
              ↳
            </span>
            <span className={styles.visuallyHidden}>Subtask: </span>
          </>
        )}
        {task.title}
      </td>
      <td>{task.skills.length > 0 ? task.skills.map((skill) => skill.name).join(", ") : "None"}</td>
      <td>
        <StatusSelect
          label={`Status for ${task.title}`}
          value={task.status}
          disabled={pending}
          onChange={(status) => onUpdate(task.id, { status })}
        />
      </td>
      <td>
        <AssigneeSelect
          label={`Assignee for ${task.title}`}
          value={task.assignee?.id ?? null}
          developers={eligibleDevelopers(task, developers)}
          disabled={pending}
          onChange={(assigneeId) => onUpdate(task.id, { assigneeId })}
        />
      </td>
    </tr>
  );
}

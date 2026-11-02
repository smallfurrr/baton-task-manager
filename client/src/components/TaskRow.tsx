import type { Developer, Task, UpdateTaskInput } from "../api/types";
import { eligibleDevelopers } from "../lib/eligibleDevelopers";
import { AssigneeSelect } from "./AssigneeSelect";
import { StatusSelect } from "./StatusSelect";

interface TaskRowProps {
  task: Task;
  developers: readonly Developer[];
  /** True while a change to this task is being saved. */
  pending: boolean;
  onUpdate: (taskId: number, changes: UpdateTaskInput) => void;
}

export function TaskRow({ task, developers, pending, onUpdate }: TaskRowProps) {
  return (
    <tr>
      <td>{task.title}</td>
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

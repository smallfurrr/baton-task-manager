import type { CSSProperties } from "react";
import type { Developer, Task, UpdateTaskInput } from "../../../api/types";
import { eligibleDevelopers } from "../../../lib/eligibleDevelopers";
import { skillChipStyle } from "../../../lib/skillColor";
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
  /** Set on a top-level task that has subtasks, to let the list collapse them. */
  collapse?: { subtaskCount: number; expanded: boolean; onToggle: () => void };
  onUpdate: (taskId: number, changes: UpdateTaskInput) => void;
}

export function TaskRow({ task, depth, developers, pending, collapse, onUpdate }: TaskRowProps) {
  return (
    <tr className={depth > 0 ? styles.subtask : styles.row}>
      {/* TaskTable.module.css reads --depth to indent the title; React's style type does not know custom properties. */}
      <td style={{ "--depth": depth } as CSSProperties}>
        {/* The indent and guide line are visual only, so say it for screen readers. */}
        {depth > 0 && <span className={styles.visuallyHidden}>Subtask: </span>}
        {depth === 0 &&
          (collapse ? (
            <button
              type="button"
              className={styles.toggle}
              aria-expanded={collapse.expanded}
              aria-label={`${collapse.expanded ? "Collapse" : "Expand"} ${task.title}`}
              onClick={collapse.onToggle}
            >
              <span className={styles.chevron} aria-hidden="true" />
            </button>
          ) : (
            // Keeps titles of tasks without subtasks lined up with those that have a toggle.
            <span className={styles.toggleSpace} aria-hidden="true" />
          ))}
        {task.title}
        {collapse && (
          <span className={styles.count}>
            {collapse.subtaskCount} {collapse.subtaskCount === 1 ? "subtask" : "subtasks"}
          </span>
        )}
      </td>
      <td>
        {task.skills.length > 0 ? (
          <ul className={styles.chips}>
            {task.skills.map((skill) => (
              <li
                key={skill.id}
                className={styles.chip}
                style={skillChipStyle(skill.name)}
                // A CSS tooltip (see .chip in TaskRow.module.css): the native `title` is slow and unreliable.
                data-tooltip={skill.addedByAi ? "Added by AI" : undefined}
              >
                {skill.addedByAi && (
                  <span className={styles.sparkle} aria-hidden="true">
                    ✨
                  </span>
                )}
                {skill.name}
                {/* The tooltip is visual only, so say it in text too. */}
                {skill.addedByAi && <span className={styles.visuallyHidden}> (added by AI)</span>}
              </li>
            ))}
          </ul>
        ) : (
          <span className={styles.none}>None</span>
        )}
      </td>
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

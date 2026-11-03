import { useId } from "react";
import type { Skill } from "../../../api/types";
import { Button } from "../../../components/Button/Button";
import { skillChipStyle } from "../../../lib/skillColor";
import { MAX_DEPTH, MAX_NODES, type FormNode, type FormNodePatch } from "../../../lib/taskFormTree";
import styles from "./TaskFormNode.module.css";

interface TaskFormNodeProps {
  node: FormNode;
  /** How deep this node sits, with the root task at 1. */
  depth: number;
  /** How many tasks the whole form holds, to stop adding at the limit. */
  totalNodes: number;
  skills: readonly Skill[];
  /** Outline number ("1", "1.1", ...) for every node, by key. */
  labels: ReadonlyMap<string, string>;
  /** Validation message for every invalid node, by key. */
  errors: ReadonlyMap<string, string>;
  /** The node whose title field should take focus when it appears. */
  focusKey?: string;
  onChange: (key: string, patch: FormNodePatch) => void;
  onAddSubtask: (parentKey: string) => void;
  onRemove: (key: string) => void;
}

/** The fields for one task in the creation form, followed by the same fields for each of its subtasks. */
export function TaskFormNode(props: TaskFormNodeProps) {
  const { node, depth, totalNodes, skills, labels, errors, focusKey, onChange, onAddSubtask, onRemove } = props;
  const labelId = useId();
  const titleId = useId();
  const errorId = useId();

  const number = labels.get(node.key) ?? "";
  const label = depth === 1 ? `Task ${number}` : `Subtask ${number}`;
  const error = errors.get(node.key);
  const atDepthLimit = depth >= MAX_DEPTH;
  const atSizeLimit = totalNodes >= MAX_NODES;
  const canAdd = !atDepthLimit && !atSizeLimit;
  const limitReason = atDepthLimit
    ? `Subtasks can only be nested ${MAX_DEPTH} levels deep`
    : `A request can create at most ${MAX_NODES} tasks`;

  function toggleSkill(skillId: number, checked: boolean) {
    onChange(node.key, {
      skillIds: checked ? [...node.skillIds, skillId] : node.skillIds.filter((id) => id !== skillId),
    });
  }

  return (
    <div>
      <div
        role="group"
        aria-labelledby={labelId}
        className={`${styles.box} ${styles[`depth${Math.min(depth, 3)}`] ?? ""}`}
      >
        <span id={labelId} className={styles.label}>
          {label}
        </span>

        <div className={styles.field}>
          <label htmlFor={titleId} className={styles.visuallyHidden}>
            Title
          </label>
          <textarea
            id={titleId}
            rows={1}
            value={node.title}
            onChange={(event) => onChange(node.key, { title: event.target.value })}
            aria-invalid={error !== undefined}
            aria-describedby={error ? errorId : undefined}
            // A subtask the user has just added is where they will type next.
            autoFocus={focusKey === node.key}
            placeholder={depth === 1 ? "As a visitor, I want to see a responsive homepage so that…" : "Describe the subtask"}
          />
          {error && (
            <p id={errorId} className={styles.fieldError}>
              {error}
            </p>
          )}
        </div>

        <div className={styles.actions}>
          <Button
            type="button"
            size="sm"
            aria-label={`Add subtask to ${label}`}
            disabled={!canAdd}
            title={canAdd ? undefined : limitReason}
            onClick={() => onAddSubtask(node.key)}
          >
            Add subtask
          </Button>
          {depth > 1 && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              aria-label={`Remove ${label}`}
              onClick={() => onRemove(node.key)}
            >
              Remove
            </Button>
          )}
        </div>

        <fieldset className={styles.skills}>
          {/* The group keeps its full name for assistive tech; sighted users get the short "Skills" label. */}
          <legend className={styles.visuallyHidden}>Required skills (optional)</legend>
          <span className={styles.skillsLabel} aria-hidden="true">
            Skills
          </span>
          {skills.map((skill) => (
            <label key={skill.id} className={styles.checkbox} style={skillChipStyle(skill.name)}>
              <input
                type="checkbox"
                checked={node.skillIds.includes(skill.id)}
                onChange={(event) => toggleSkill(skill.id, event.target.checked)}
              />
              {skill.name}
            </label>
          ))}
          {node.skillIds.length === 0 && (
            <p className={styles.hint}>
              <span aria-hidden="true">✨ </span>Leave empty and skills will be suggested automatically.
            </p>
          )}
        </fieldset>
      </div>

      {node.subtasks.length > 0 && (
        <div className={styles.children}>
          {node.subtasks.map((child) => (
            <TaskFormNode key={child.key} {...props} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

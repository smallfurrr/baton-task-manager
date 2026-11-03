import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { CreateTaskInput, Skill } from "../../../api/types";
import { Banner } from "../../../components/Banner/Banner";
import { Button, buttonClassName } from "../../../components/Button/Button";
import {
  addSubtask,
  countNodes,
  hasTaskWithoutSkills,
  newNode,
  numberLabels,
  removeNode,
  toCreateInput,
  updateNode,
  validateTree,
  type FormNodePatch,
} from "../../../lib/taskFormTree";
import { TaskFormNode } from "../TaskFormNode/TaskFormNode";
import styles from "./TaskForm.module.css";

const NO_ERRORS: ReadonlyMap<string, string> = new Map();

interface TaskFormProps {
  skills: readonly Skill[];
  submitting: boolean;
  /** A message from a failed save, shown above the form. */
  submitError?: string;
  onSubmit: (input: CreateTaskInput) => void;
}

export function TaskForm({ skills, submitting, submitError, onSubmit }: TaskFormProps) {
  const [root, setRoot] = useState(newNode);
  const [focusKey, setFocusKey] = useState<string>();
  // Only show validation messages after the first attempt to save.
  const [attempted, setAttempted] = useState(false);

  const labels = useMemo(() => numberLabels(root), [root]);
  const errors = attempted ? validateTree(root) : NO_ERRORS;

  function handleChange(key: string, patch: FormNodePatch) {
    setRoot((current) => updateNode(current, key, patch));
  }

  function handleAddSubtask(parentKey: string) {
    const child = newNode();
    setRoot((current) => addSubtask(current, parentKey, child));
    setFocusKey(child.key);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    if (validateTree(root).size > 0) return;
    onSubmit(toCreateInput(root, skills));
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate aria-busy={submitting}>
      {submitError && <Banner variant="error" message={submitError} />}

      {/* While saving, a disabled fieldset locks every field at once so nothing changes mid-request. */}
      <fieldset className={styles.fields} disabled={submitting}>
        <TaskFormNode
          node={root}
          depth={1}
          totalNodes={countNodes(root)}
          skills={skills}
          labels={labels}
          errors={errors}
          focusKey={focusKey}
          onChange={handleChange}
          onAddSubtask={handleAddSubtask}
          onRemove={(key) => setRoot((current) => removeNode(current, key))}
        />
      </fieldset>

      {submitting && (
        <div role="status" className={styles.progress}>
          <div className={styles.track} aria-hidden="true">
            <div className={styles.bar} />
          </div>
          {/* Only mention suggestions when there is something for the classifier to do. */}
          {hasTaskWithoutSkills(root) ? "Creating task and suggesting skills…" : "Creating task…"}
        </div>
      )}

      <div className={styles.actions}>
        <Link
          to="/"
          className={buttonClassName("secondary")}
          // A link cannot be disabled, so block it while the request is in flight.
          aria-disabled={submitting}
          tabIndex={submitting ? -1 : undefined}
          onClick={(event) => submitting && event.preventDefault()}
        >
          Cancel
        </Link>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting && <span className={styles.spinner} aria-hidden="true" />}
          {submitting ? "Creating…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

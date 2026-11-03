import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { CreateTaskInput, Skill } from "../../../api/types";
import { Banner } from "../../../components/Banner/Banner";
import { Button, buttonClassName } from "../../../components/Button/Button";
import {
  addSubtask,
  countNodes,
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
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {submitError && <Banner variant="error" message={submitError} />}

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

      <div className={styles.actions}>
        <Link to="/" className={buttonClassName("secondary")}>
          Cancel
        </Link>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

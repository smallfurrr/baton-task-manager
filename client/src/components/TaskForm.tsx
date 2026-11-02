import { useId, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { CreateTaskInput, Skill } from "../api/types";
import { ErrorBanner } from "./ErrorBanner";
import styles from "./TaskForm.module.css";

export const MAX_TITLE_LENGTH = 500;

/** Returns a message describing what is wrong with the title, or undefined if it is fine. */
export function validateTitle(title: string): string | undefined {
  const trimmed = title.trim();
  if (trimmed.length === 0) return "Enter a title for the task.";
  if (trimmed.length > MAX_TITLE_LENGTH) return `The title must be at most ${MAX_TITLE_LENGTH} characters.`;
  return undefined;
}

interface TaskFormProps {
  skills: readonly Skill[];
  submitting: boolean;
  /** A message from a failed save, shown above the form. */
  submitError?: string;
  onSubmit: (input: CreateTaskInput) => void;
}

export function TaskForm({ skills, submitting, submitError, onSubmit }: TaskFormProps) {
  const titleId = useId();
  const titleErrorId = useId();
  const [title, setTitle] = useState("");
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(new Set());
  // Only show validation messages after the first attempt to save.
  const [attempted, setAttempted] = useState(false);

  const titleError = attempted ? validateTitle(title) : undefined;

  function toggleSkill(skillId: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(skillId)) next.delete(skillId);
      else next.add(skillId);
      return next;
    });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    if (validateTitle(title)) return;
    onSubmit({
      title: title.trim(),
      skillIds: skills.filter((skill) => selectedIds.has(skill.id)).map((skill) => skill.id),
    });
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {submitError && <ErrorBanner message={submitError} />}

      <div className={styles.field}>
        <label htmlFor={titleId}>Title</label>
        <textarea
          id={titleId}
          rows={3}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-invalid={titleError !== undefined}
          aria-describedby={titleError ? titleErrorId : undefined}
          placeholder="As a visitor, I want to see a responsive homepage so that…"
        />
        {titleError && (
          <p id={titleErrorId} className={styles.fieldError}>
            {titleError}
          </p>
        )}
      </div>

      <fieldset className={styles.skills}>
        <legend>Required skills (optional)</legend>
        {skills.map((skill) => (
          <label key={skill.id} className={styles.checkbox}>
            <input type="checkbox" checked={selectedIds.has(skill.id)} onChange={() => toggleSkill(skill.id)} />
            {skill.name}
          </label>
        ))}
      </fieldset>

      <div className={styles.actions}>
        <Link to="/" className={styles.cancel}>
          Cancel
        </Link>
        <button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

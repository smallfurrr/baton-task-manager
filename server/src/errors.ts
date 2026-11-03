import type { OpenSubtask } from "./domain/task.js";

/** An error with an HTTP status and a stable machine-readable code. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(404, "NOT_FOUND", message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, "VALIDATION_ERROR", message, details);
    this.name = "ValidationError";
  }
}

/** The request is well-formed but refers to something that does not exist. */
export class InvalidReferenceError extends AppError {
  constructor(message: string, details?: unknown) {
    super(422, "INVALID_REFERENCE", message, details);
    this.name = "InvalidReferenceError";
  }
}

/** The developer lacks one or more skills the task requires. */
export class SkillMismatchError extends AppError {
  constructor(developerName: string, missing: ReadonlyArray<{ id: number; name: string }>) {
    super(
      409,
      "SKILL_MISMATCH",
      `${developerName} cannot be assigned: missing required skill(s) ${missing.map((s) => s.name).join(", ")}`,
      { missingSkills: missing },
    );
    this.name = "SkillMismatchError";
  }
}

const TITLES_IN_MESSAGE = 3;

/** The task cannot be marked Done because some subtask beneath it is not Done. */
export class IncompleteSubtasksError extends AppError {
  constructor(openSubtasks: readonly OpenSubtask[]) {
    const titles = openSubtasks.slice(0, TITLES_IN_MESSAGE).map((subtask) => subtask.title);
    const more = openSubtasks.length - titles.length;
    super(
      409,
      "INCOMPLETE_SUBTASKS",
      `Cannot mark task Done: ${openSubtasks.length} subtask(s) are not Done (${titles.join(", ")}${more > 0 ? `, +${more} more` : ""})`,
      { openSubtasks },
    );
    this.name = "IncompleteSubtasksError";
  }
}

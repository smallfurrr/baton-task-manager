import type { Developer, Skill } from "../api/types";

/**
 * Developers who hold every skill the task requires. This only narrows the
 * Assignee dropdown; the server enforces the same rule and has the final say.
 */
export function eligibleDevelopers(task: { skills: readonly Skill[] }, developers: readonly Developer[]): Developer[] {
  return developers.filter((developer) => {
    const heldIds = new Set(developer.skills.map((skill) => skill.id));
    return task.skills.every((skill) => heldIds.has(skill.id));
  });
}

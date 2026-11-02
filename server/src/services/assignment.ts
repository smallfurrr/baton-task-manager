import type { SkillRow } from "../repositories/skillRepository.js";

/**
 * The assignment rule: a developer may take a task only if they hold ALL of
 * the skills it requires. Returns the required skills the developer lacks, so
 * an empty result means the assignment is allowed. A task with no required
 * skills therefore has no missing skills for anyone.
 */
export function missingSkills(required: readonly SkillRow[], held: readonly SkillRow[]): SkillRow[] {
  const heldIds = new Set(held.map((skill) => skill.id));
  return required.filter((skill) => !heldIds.has(skill.id));
}

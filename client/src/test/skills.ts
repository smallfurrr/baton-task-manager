import type { Skill, TaskSkill } from "../api/types";

/** Skills as they appear on a task: the same skills, each marked as user-chosen unless `addedByAi` is set. */
export function taskSkills(skills: readonly Skill[], addedByAi = false): TaskSkill[] {
  return skills.map((skill) => ({ ...skill, addedByAi }));
}

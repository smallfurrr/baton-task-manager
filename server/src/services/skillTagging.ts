import type { SkillRow } from "../repositories/skillRepository.js";
import type { SkillClassifier } from "./skillClassifier.js";

/** How many classifier calls may be in flight at once for one request. */
export const CLASSIFIER_CONCURRENCY = 5;

/**
 * Map classifier output to skill ids. Names are matched ignoring case and
 * surrounding whitespace; anything that is not a known skill is dropped, and
 * each skill appears at most once. The classifier is never trusted to be valid.
 */
export function resolveSkillIds(names: unknown, skills: SkillRow[]): number[] {
  if (!Array.isArray(names)) return [];
  const byName = new Map(skills.map((skill) => [skill.name.trim().toLowerCase(), skill.id]));
  const ids = new Set<number>();
  for (const name of names) {
    if (typeof name !== "string") continue;
    const id = byName.get(name.trim().toLowerCase());
    if (id !== undefined) ids.add(id);
  }
  return [...ids];
}

/**
 * Skill ids for one task title. A classifier failure is logged and yields no
 * skills: tagging is a convenience and must never block task creation.
 */
export async function tagSkills(title: string, skills: SkillRow[], classifier: SkillClassifier): Promise<number[]> {
  try {
    const names = await classifier.classify(
      title,
      skills.map((skill) => skill.name),
    );
    return resolveSkillIds(names, skills);
  } catch (error) {
    console.warn(`Skill classification failed for "${title}": ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

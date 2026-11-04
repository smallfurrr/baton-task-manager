import { mapWithConcurrency } from "../lib/concurrency.js";
import type { SkillRow } from "../repositories/skillRepository.js";
import type { SkillClassifier } from "./skillClassifier.js";

/** How many classifier calls may be in flight at once for one request. */
export const CLASSIFIER_CONCURRENCY = 5;

/** Consecutive failed classifier calls after which the rest of a request is left untagged. */
export const MAX_CONSECUTIVE_FAILURES = 3;

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
 * Skill ids for each title, in order, from at most `CLASSIFIER_CONCURRENCY`
 * concurrent classifier calls. Tagging is a convenience and must never block
 * task creation, so a failed call is logged and yields no skills.
 *
 * Circuit breaker: after `MAX_CONSECUTIVE_FAILURES` failed calls in a row the
 * classifier is treated as down, and titles not yet started are left untagged
 * instead of each waiting out its own timeout. Any success resets the count.
 * The state lives in one call, so the next request tries the classifier again.
 */
export async function tagTitles(titles: string[], skills: SkillRow[], classifier: SkillClassifier): Promise<number[][]> {
  const skillNames = skills.map((skill) => skill.name);
  let failuresInARow = 0;
  let skipped = 0;

  const results = await mapWithConcurrency(titles, CLASSIFIER_CONCURRENCY, async (title) => {
    if (failuresInARow >= MAX_CONSECUTIVE_FAILURES) {
      skipped++;
      return [];
    }
    try {
      const ids = resolveSkillIds(await classifier.classify(title, skillNames), skills);
      failuresInARow = 0;
      return ids;
    } catch (error) {
      failuresInARow++;
      console.warn(`Skill classification failed for "${title}": ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  });

  if (skipped > 0) {
    console.warn(`Skill classification skipped for ${skipped} task(s) after ${MAX_CONSECUTIVE_FAILURES} failures in a row`);
  }
  return results;
}

import type { SkillClassifier } from "../services/skillClassifier.js";

export interface FakeClassifier extends SkillClassifier {
  /** Every call made, in order. */
  calls: { title: string; skillNames: string[] }[];
}

/**
 * Stand-in for the LLM. `answer` maps a title to the names to return (or to an
 * error to throw); titles it does not know get no skills.
 */
export function fakeClassifier(answer: Record<string, string[] | Error> = {}): FakeClassifier {
  const calls: FakeClassifier["calls"] = [];
  return {
    calls,
    async classify(title, skillNames) {
      calls.push({ title, skillNames });
      const result = answer[title] ?? [];
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

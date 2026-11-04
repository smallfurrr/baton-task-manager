import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeClassifier } from "../test/fakeClassifier.js";
import { CLASSIFIER_CONCURRENCY, resolveSkillIds, tagTitles } from "./skillTagging.js";

const skills = [
  { id: 1, name: "Frontend" },
  { id: 2, name: "Backend" },
];

afterEach(() => vi.restoreAllMocks());

describe("resolveSkillIds", () => {
  it("maps known names to ids", () => {
    expect(resolveSkillIds(["Backend", "Frontend"], skills)).toEqual([2, 1]);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(resolveSkillIds([" backend ", "FRONTEND"], skills)).toEqual([2, 1]);
  });

  it("drops unknown names and non-strings", () => {
    expect(resolveSkillIds(["DevOps", 3, null, "Backend"], skills)).toEqual([2]);
  });

  it("lists each skill once", () => {
    expect(resolveSkillIds(["Backend", "backend"], skills)).toEqual([2]);
  });

  it("returns nothing when the output is not an array", () => {
    expect(resolveSkillIds("Backend", skills)).toEqual([]);
    expect(resolveSkillIds({ skills: ["Backend"] }, skills)).toEqual([]);
    expect(resolveSkillIds(undefined, skills)).toEqual([]);
  });
});

describe("tagTitles", () => {
  const down = (titles: string[]) => Object.fromEntries(titles.map((title) => [title, new Error("down")]));

  it("passes each title and the skill names to the classifier, and returns ids in order", async () => {
    const classifier = fakeClassifier({ "Build the API": ["Backend"], "Style it": ["Frontend"] });

    expect(await tagTitles(["Build the API", "Style it"], skills, classifier)).toEqual([[2], [1]]);
    expect(classifier.calls).toEqual([
      { title: "Build the API", skillNames: ["Frontend", "Backend"] },
      { title: "Style it", skillNames: ["Frontend", "Backend"] },
    ]);
  });

  it("logs and returns no skills for a call that throws, and still tags the others", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const ids = await tagTitles(["Anything", "Build"], skills, fakeClassifier({ Anything: new Error("boom"), Build: ["Backend"] }));

    expect(ids).toEqual([[], [2]]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("boom"));
  });

  describe("circuit breaker", () => {
    it("stops calling the classifier after 3 failures in a row and leaves the rest untagged", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const titles = Array.from({ length: 12 }, (_, i) => `task ${i}`);
      const classifier = fakeClassifier(down(titles));

      const ids = await tagTitles(titles, skills, classifier);

      expect(ids).toEqual(titles.map(() => []));
      // Only the calls already in flight when the breaker tripped were made.
      expect(classifier.calls).toHaveLength(CLASSIFIER_CONCURRENCY);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("skipped for 7 task(s)"));
    });

    it("does not trip on failures that are not in a row", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const titles = ["a", "b", "c", "d", "e", "f", "g"];
      // Failures at a, b, d, e with a success at c: the count never reaches 3.
      const classifier = fakeClassifier({
        ...down(["a", "b", "d", "e"]),
        c: ["Backend"],
        f: ["Frontend"],
        g: ["Backend"],
      });

      const ids = await tagTitles(titles, skills, classifier);

      expect(classifier.calls).toHaveLength(7);
      expect(ids.slice(5)).toEqual([[1], [2]]);
    });

    it("starts afresh on the next call", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const titles = Array.from({ length: 8 }, (_, i) => `task ${i}`);
      await tagTitles(titles, skills, fakeClassifier(down(titles)));

      const classifier = fakeClassifier({ "task 0": ["Backend"] });
      expect(await tagTitles(["task 0"], skills, classifier)).toEqual([[2]]);
    });
  });
});

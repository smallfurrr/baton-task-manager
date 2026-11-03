import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeClassifier } from "../test/fakeClassifier.js";
import { mapWithConcurrency, resolveSkillIds, tagSkills } from "./skillTagging.js";

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

describe("tagSkills", () => {
  it("passes the title and the skill names to the classifier", async () => {
    const classifier = fakeClassifier({ "Build the API": ["Backend"] });

    expect(await tagSkills("Build the API", skills, classifier)).toEqual([2]);
    expect(classifier.calls).toEqual([{ title: "Build the API", skillNames: ["Frontend", "Backend"] }]);
  });

  it("logs and returns no skills when the classifier throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const ids = await tagSkills("Anything", skills, fakeClassifier({ Anything: new Error("boom") }));

    expect(ids).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("boom"));
  });
});

describe("mapWithConcurrency", () => {
  it("keeps results in input order", async () => {
    const results = await mapWithConcurrency([30, 10, 20], 2, async (ms) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return ms;
    });
    expect(results).toEqual([30, 10, 20]);
  });

  it("never runs more than the limit at once", async () => {
    let running = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 12 }, (_, i) => i), 5, async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running--;
    });
    expect(peak).toBe(5);
  });

  it("handles an empty list", async () => {
    expect(await mapWithConcurrency([], 5, async (x) => x)).toEqual([]);
  });
});

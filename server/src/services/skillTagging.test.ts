import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeClassifier } from "../test/fakeClassifier.js";
import { resolveSkillIds, tagSkills } from "./skillTagging.js";

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

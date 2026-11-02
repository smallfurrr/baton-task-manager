import { describe, expect, it } from "vitest";
import { missingSkills } from "./assignment.js";

const frontend = { id: 1, name: "Frontend" };
const backend = { id: 2, name: "Backend" };

describe("missingSkills", () => {
  it("allows a developer with exactly the required skills", () => {
    expect(missingSkills([frontend, backend], [backend, frontend])).toEqual([]);
  });

  it("allows a developer with more skills than required", () => {
    expect(missingSkills([frontend], [frontend, backend])).toEqual([]);
  });

  it("reports the one skill that is missing", () => {
    expect(missingSkills([frontend, backend], [frontend])).toEqual([backend]);
  });

  it("reports every required skill when the developer has none of them", () => {
    expect(missingSkills([frontend, backend], [])).toEqual([frontend, backend]);
  });

  it("reports the skill when the developer has only a different one", () => {
    expect(missingSkills([frontend], [backend])).toEqual([frontend]);
  });

  it("allows anyone when the task requires no skills", () => {
    expect(missingSkills([], [])).toEqual([]);
    expect(missingSkills([], [frontend])).toEqual([]);
  });

  it("compares skills by id, not by name", () => {
    expect(missingSkills([frontend], [{ id: 99, name: "Frontend" }])).toEqual([frontend]);
  });
});

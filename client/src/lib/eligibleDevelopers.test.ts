import { describe, expect, it } from "vitest";
import type { Developer, Skill } from "../api/types";
import { eligibleDevelopers } from "./eligibleDevelopers";

const frontend: Skill = { id: 1, name: "Frontend" };
const backend: Skill = { id: 2, name: "Backend" };

const alice: Developer = { id: 1, name: "Alice", skills: [frontend] };
const bob: Developer = { id: 2, name: "Bob", skills: [backend] };
const carol: Developer = { id: 3, name: "Carol", skills: [frontend, backend] };
const dave: Developer = { id: 4, name: "Dave", skills: [backend] };
const everyone = [alice, bob, carol, dave];

describe("eligibleDevelopers", () => {
  it("offers everyone for a task that requires no skills", () => {
    expect(eligibleDevelopers({ skills: [] }, everyone)).toEqual(everyone);
  });

  it("offers only developers with the single required skill", () => {
    expect(eligibleDevelopers({ skills: [frontend] }, everyone)).toEqual([alice, carol]);
    expect(eligibleDevelopers({ skills: [backend] }, everyone)).toEqual([bob, carol, dave]);
  });

  it("requires ALL skills, not just one", () => {
    expect(eligibleDevelopers({ skills: [frontend, backend] }, everyone)).toEqual([carol]);
  });

  it("returns nobody when no developer qualifies", () => {
    expect(eligibleDevelopers({ skills: [frontend, backend] }, [alice, bob])).toEqual([]);
  });

  it("includes a developer with no skills only for a task that requires none", () => {
    const erin: Developer = { id: 5, name: "Erin", skills: [] };

    expect(eligibleDevelopers({ skills: [] }, [erin])).toEqual([erin]);
    expect(eligibleDevelopers({ skills: [frontend] }, [erin])).toEqual([]);
  });

  it("compares skills by id", () => {
    const impostor: Developer = { id: 9, name: "Impostor", skills: [{ id: 99, name: "Frontend" }] };

    expect(eligibleDevelopers({ skills: [frontend] }, [impostor])).toEqual([]);
  });
});

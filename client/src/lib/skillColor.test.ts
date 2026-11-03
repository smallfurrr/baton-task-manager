import { describe, expect, it } from "vitest";
import { skillChipStyle, skillColors } from "./skillColor";

describe("skillColors", () => {
  it("gives Frontend and Backend different colours", () => {
    expect(skillColors("Frontend")).not.toEqual(skillColors("Backend"));
  });

  it("ignores case and surrounding whitespace for known skills", () => {
    expect(skillColors("  BACKEND ")).toEqual(skillColors("Backend"));
  });

  it("gives an unknown skill the same colour every time", () => {
    expect(skillColors("DevOps")).toEqual(skillColors("DevOps"));
  });

  it("still returns a colour for an empty name", () => {
    expect(skillColors("")).toBeDefined();
  });
});

describe("skillChipStyle", () => {
  it("exposes the colours as CSS custom properties", () => {
    const style = skillChipStyle("Frontend") as Record<string, string>;

    expect(style["--chip-bg"]).toBe(skillColors("Frontend").background);
    expect(style["--chip-text"]).toBe(skillColors("Frontend").text);
  });
});

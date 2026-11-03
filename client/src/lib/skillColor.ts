import type { CSSProperties } from "react";

interface Colors {
  background: string;
  text: string;
}

const TEAL: Colors = { background: "#d9f4ee", text: "#0b6b5d" };
const ORANGE: Colors = { background: "#ffedd5", text: "#9a4a07" };

/** Skills the seed data knows about get a fixed, recognisable colour. */
const KNOWN: Record<string, Colors> = {
  frontend: TEAL,
  backend: ORANGE,
};

/** Any other skill gets one of these, picked from its name so it stays the same between visits. Blue is left to the In progress status. */
const FALLBACK: Colors[] = [
  { background: "#fde4ec", text: "#a3194d" },
  { background: "#fdf3c4", text: "#6b5400" },
  { background: "#e9ecef", text: "#3f4b57" },
  { background: "#e6f4d7", text: "#3b6212" },
];

export function skillColors(name: string): Colors {
  const key = name.trim().toLowerCase();
  const known = KNOWN[key];
  if (known) return known;

  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return FALLBACK[hash % FALLBACK.length] ?? TEAL;
}

/**
 * Inline custom properties that a skill chip's stylesheet reads as
 * `--chip-bg` and `--chip-text`. React's style type does not know custom properties.
 */
export function skillChipStyle(name: string): CSSProperties {
  const { background, text } = skillColors(name);
  return { "--chip-bg": background, "--chip-text": text } as CSSProperties;
}

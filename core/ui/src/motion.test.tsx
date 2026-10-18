import { expect, test } from "vitest";
import { aetherThemes, resolveTheme } from "./themes";

/**
 * Motion and touch are theme data, not per-widget decisions (Jonathan,
 * 2026-09-30: fluid animation, and tablets alongside desktop, are the focus).
 * These pin the two things that make that work: every theme carries the
 * durations and curves, and widget CSS spends them rather than inventing its
 * own. Without the second check the system drifts back to the twelve different
 * hard-coded durations it had.
 */

const MOTION = ["motion-fast", "motion-base", "motion-slow", "motion-ease", "motion-ease-out", "motion-ease-spring"];

test("every theme resolves the full motion vocabulary", () => {
  for (const manifest of Object.values(aetherThemes)) {
    const theme = resolveTheme(manifest);
    const missing = MOTION.filter((token) => !(token in theme.effects));
    expect(`${manifest.id}: ${missing.join(", ")}`).toBe(`${manifest.id}: `);
  }
});

test("every theme resolves touch geometry, so a coarse pointer grows controls", () => {
  for (const manifest of Object.values(aetherThemes)) {
    const theme = resolveTheme(manifest);
    // A finger needs about 44px; the desktop control is 28.
    expect(parseInt(theme.touch["size-control"], 10)).toBeGreaterThanOrEqual(44);
    expect(parseInt(theme.touch["size-row"], 10)).toBeGreaterThanOrEqual(44);
  }
});

const styles = import.meta.glob<string>("./**/*.css", { query: "?raw", import: "default", eager: true });

test("widget CSS spends the motion tokens instead of hard-coding durations", () => {
  // A duration inside a transition or animation shorthand. Keyframe definitions
  // and scroll timings are not motion the theme owns, so only these two count.
  const DECLARATION = /(?:transition|animation)(?:-duration)?\s*:\s*([^;}]+)/g;
  const LITERAL = /(?:^|[\s,(])(\d*\.?\d+)(m?s)\b/;
  const offenders: string[] = [];
  for (const [path, source] of Object.entries(styles)) {
    for (const match of source.matchAll(DECLARATION)) {
      // Per comma-separated part: a declaration that tokenises one property and
      // hard-codes the next is exactly the drift this is here to catch.
      for (const part of match[1].split(",")) {
        if (part.includes("--aether-motion")) continue;
        if (/\bnone\b|\binherit\b|\binitial\b|\bunset\b|infinite/.test(part)) continue;
        if (LITERAL.exec(part)) offenders.push(`${path}: ${part.trim().slice(0, 60)}`);
      }
    }
  }
  expect(offenders).toEqual([]);
});

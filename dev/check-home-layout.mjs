#!/usr/bin/env node
// Home-shell layout guard.
//
// Every Aether app home is one component (studio/src/LibraryHome.tsx) drawn as
// a two-column grid: a sidebar rail and the content beside it. The rail's width
// was once declared twice — a grid track on `.library-root` and a `width` on
// `.library-nav` — and the breakpoints moved only the track. Below 1100px the
// sidebar was then 210px inside a 175px column and painted over the content by
// 35px, and below 860px by 55px; measured in Chrome before the fix at seven of
// nine representative widths.
//
// One variable now declares it. This fails the build if a second declaration
// comes back, because the overlap is invisible until someone narrows a window.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(repoRoot, "studio/src/library.css");
const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const problems = [];

// Every multi-column track on the root must come from the variable.
for (const m of css.matchAll(/\.library-root\s*\{[^}]*?grid-template-columns:\s*([^;]+);/g)) {
  const value = m[1].trim();
  const single = value.split(/\s+(?![^(]*\))/).length === 1;
  if (!single && !value.includes("var(--library-nav)")) {
    problems.push(`.library-root sets grid-template-columns: ${value} — use var(--library-nav) so the rail and its track cannot disagree.`);
  }
}

// And the sidebar itself must read the same variable, or stop being a column.
for (const m of css.matchAll(/\.library-nav\s*\{[^}]*?(?<!max-|min-)width:\s*([^;]+);/g)) {
  const value = m[1].trim();
  if (!value.includes("var(--library-nav)") && value !== "auto" && value !== "100%") {
    problems.push(`.library-nav sets width: ${value} — use var(--library-nav), or auto where it stops being a column.`);
  }
}

// A breakpoint carries no more specificity than the base rule it adjusts, so a
// base rule declared after the ladder silently wins. That cost a bug too:
// `.library-user-row` sat below the stacked rule meant to hide it and pushed
// the row 34px past a 589px window. The ladder stays last.
const ladder = css.search(/@media \(max-width: 1180px\)/);
if (ladder === -1) {
  problems.push("the responsive ladder is gone — the home shell needs its width steps.");
} else {
  for (const m of css.slice(ladder).matchAll(/^(\.[a-zA-Z][^\n{]*)\{/gm)) {
    problems.push(`\`${m[1].trim()}\` is declared after the responsive ladder, so it outranks it at the same specificity. Move it above.`);
  }
}

if (problems.length) {
  for (const p of problems) console.error(`studio/src/library.css: ${p}`);
  process.exit(1);
}
console.log("Home shell: the sidebar rail and its grid track share one declaration.");

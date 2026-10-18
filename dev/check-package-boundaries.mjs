import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { scanBoundaries, compareBoundaries } from "./package-boundaries.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const inventory = JSON.parse(readFileSync(new URL("./web-packages.json", import.meta.url), "utf8"));
const baseline = JSON.parse(readFileSync(new URL("./package-boundaries-baseline.json", import.meta.url), "utf8"));
const actual = scanBoundaries(root, [...inventory.map(pkg => pkg.path), "core/assets"]);
const { added, removed } = compareBoundaries(actual, baseline);
for (const key of added) console.error(`New cross-package relative import: ${key}`);
for (const key of removed) console.error(`Remove resolved package-boundary debt from the baseline: ${key}`);
console.log(`Package boundaries: ${Object.values(actual).reduce((sum, count) => sum + count, 0)} existing imports; ${added.length} new, ${removed.length} resolved.`);
process.exitCode = added.length || removed.length ? 1 : 0;

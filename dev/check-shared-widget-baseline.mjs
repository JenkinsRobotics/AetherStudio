#!/usr/bin/env node
// Ratchet the existing detector without modifying its separately claimed implementation.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFindings, addedFindings } from "./shared-widget-baseline.mjs";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync(process.execPath, [join(root, "dev/check-shared-widget-overrides.mjs")], { encoding: "utf8", cwd: root });
if (result.error || result.status !== 0) {
  console.error(result.error ?? result.stderr);
  process.exit(1);
}
const current = parseFindings(result.stdout);
const summary = result.stdout.match(/(\d+) product rule\(s\) restyle shared widgets/);
const expected = summary ? Number(summary[1]) : result.stdout.includes("No product CSS restyles shared widgets.") ? 0 : null;
if (expected === null || expected !== current.length) {
  console.error("Shared-widget detector output changed; update and verify the baseline parser before accepting it.");
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(join(root, "dev/shared-widget-overrides-baseline.json"), "utf8")).findings;
const added = addedFindings(current, baseline);
const removed = addedFindings(baseline, current);
if (added.length) {
  console.error(`New shared-widget overrides (${added.length}):\n${added.join("\n")}\nMove presentation into core/ui; do not expand the baseline to hide new overrides.`);
  process.exitCode = 1;
} else if (removed.length) {
  console.error(`Resolved overrides (${removed.length}): remove these entries from dev/shared-widget-overrides-baseline.json so they cannot be reintroduced:\n${removed.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(`Shared-widget baseline: no new detected overrides (${current.length} existing findings; ${baseline.length} baselined).`);
}

#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = false;
for (const args of [
  ["dev/check-theme-literals.mjs"],
  ["dev/check-home-layout.mjs"],
  ["dev/check-icon-pack.mjs"],
  ["dev/check-shared-widget-baseline.mjs"],
  ["--test", "dev/shared-widget-baseline.test.mjs"],
  ["dev/check-package-boundaries.mjs"],
  ["--test", "dev/package-boundaries.test.mjs"],
  ["--test", "dev/web-install-order.test.mjs"],
]) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit" });
  if (result.error || result.status !== 0) { console.error(result.error ?? `Failed: ${args.join(" ")}`); failed = true; }
}
process.exitCode = failed ? 1 : 0;

#!/usr/bin/env node
// One package inventory for local verification and the CI matrix. No shell interpolation.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { installationOrder } from "./web-install-order.mjs";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packages = JSON.parse(readFileSync(join(root, "dev/web-packages.json"), "utf8"));
const [mode = "check", selected] = process.argv.slice(2);
// New first-party packages must join CI rather than silently escaping the matrix.
const candidates = ["studio", "Aether CAD", "Aether CAD/aether-engine"];
for (const name of readdirSync(root)) {
  if (name.startsWith("aether-")) candidates.push(name, `${name}/web`);
}
for (const name of readdirSync(join(root, "core"))) candidates.push(`core/${name}`);
const discovered = candidates.filter(path => existsSync(join(root, path, "package.json")));
const missing = discovered.filter(path => !packages.some(pkg => pkg.path === path));
const stale = packages.filter(pkg => !discovered.includes(pkg.path));
if (missing.length || stale.length) {
  console.error(`Update dev/web-packages.json. Missing: ${missing.join(", ")}; stale: ${stale.map(p => p.path).join(", ")}`);
  process.exit(1);
}
for (const pkg of packages.filter(p => p.installOnly)) {
  const scripts = JSON.parse(readFileSync(join(root, pkg.path, "package.json"), "utf8")).scripts ?? {};
  if (["test", "build", "check", "typecheck"].some(command => scripts[command])) {
    console.error(`${pkg.path} now has verification commands; remove installOnly to gate them.`);
    process.exit(1);
  }
}

if (mode === "--matrix") {
  console.log(JSON.stringify({ include: packages.filter(p => !p.installOnly) }));
  process.exit(0);
}
if (!["install", "test", "build", "check"].includes(mode) || (selected && !packages.some(p => p.path === selected))) {
  console.error("Usage: node dev/web-checks.mjs install|test|build|check [package path]");
  process.exit(2);
}
let failed = false;
function run(args, path) {
  console.log(`\n[${path}] npm ${args.join(" ")}`);
  const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", args, {
    cwd: join(root, path), stdio: "inherit", shell: process.platform === "win32",
  });
  if (result.error || result.status !== 0) {
    console.error(result.error?.message ?? `Failed: ${path} (${result.status ?? result.signal})`);
    failed = true;
  }
}
const selectedPackages = packages.filter(p => !selected || p.path === selected);
const orderedPackages = mode === "install" && !selected ? installationOrder(selectedPackages, pkg => {
  const manifest = JSON.parse(readFileSync(join(root, pkg.path, "package.json"), "utf8"));
  return Object.values({ ...manifest.dependencies, ...manifest.devDependencies })
    .filter(value => value.startsWith("file:"))
    .map(value => relative(root, resolve(root, pkg.path, value.slice(5))).split(sep).join("/"));
}) : selectedPackages;
for (const pkg of orderedPackages) {
  if (mode === "install") { run(["ci"], pkg.path); continue; }
  if (pkg.installOnly) continue;
  const { scripts = {} } = JSON.parse(readFileSync(join(root, pkg.path, "package.json"), "utf8"));
  if ((mode === "test" || mode === "check") && scripts.test) run(["test"], pkg.path);
  if (mode === "check" && scripts.lint) run(["run", "lint"], pkg.path);
  if (mode === "build" || mode === "check") {
    const typecheck = scripts.typecheck ? "typecheck" : scripts.check ? "check" : null;
    if (typecheck) run(["run", typecheck], pkg.path);
    if (scripts.build) run(["run", "build"], pkg.path);
  }
  if (mode === "check" && !scripts.test && !scripts.build && !scripts.check && !scripts.typecheck) {
    console.error(`${pkg.path} has no verification command; add one before marking it gated.`);
    failed = true;
  }
}
process.exitCode = failed ? 1 : 0;

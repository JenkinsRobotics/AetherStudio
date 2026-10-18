#!/usr/bin/env node
// Icon pack guard: every SVG in core/assets/icons is the default pack (the
// AetherIcon registry globs the folder), so each file must follow the pack's
// drawing conventions — 24px grid, currentColor strokes, no raster/text.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconDir = join(repoRoot, "core/assets/icons");
const files = readdirSync(iconDir).filter((name) => name.endsWith(".svg"));
const registry = readFileSync(join(repoRoot, "core/ui/src/AetherIcon.tsx"), "utf8");
let failures = 0;
const fail = (message) => { console.error(message); failures += 1; };
if (!registry.includes('import.meta.glob<string>("../../assets/icons/*.svg"')) fail("AetherIcon.tsx no longer globs core/assets/icons");
if (!existsSync(join(iconDir, "pack.json"))) fail("core/assets/icons/pack.json missing");
for (const file of files) {
  const markup = readFileSync(join(iconDir, file), "utf8");
  if (!/^[a-z0-9_-]+\.svg$/.test(file)) fail(`${file}: pack names are lower-case kebab`);
  if (!markup.includes('viewBox="0 0 24 24"')) fail(`${file}: not on the 24px grid`);
  if (!/^\/file-[a-z]+\.svg$/.test(`/${file}`) && !markup.includes('stroke="currentColor"')) fail(`${file}: strokes must be currentColor`);
  if (/<(?:text|image|script|foreignObject)\b/i.test(markup)) fail(`${file}: embedded text/raster/script`);
}
if (failures) process.exit(1);
console.log(`Icon pack ok: ${files.length} icons in the default pack.`);

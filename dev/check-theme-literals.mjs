#!/usr/bin/env node
// Theme guard: app CSS must express color through tokens/variables.
// Raw color literals are allowed ONLY where palettes are DEFINED:
// custom-property declarations (--name: …) or a line marked /* literal-ok */.
// Scope today: studio/src. Expand per-app as each stylesheet is tokenized
// (ponytail: CAD + animation sweeps are follow-up packets).
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const roots = [
  join(repoRoot, "core/ui/src"),
  join(repoRoot, "core/ui/src/kit"),
  join(repoRoot, "core/ui/gallery"),
  join(repoRoot, "core/ui/gallery/showcase"),
  join(repoRoot, "core/ui/gallery/animation-mockup"),
  join(repoRoot, "core/ui/gallery/atlas-demo"),
  join(repoRoot, "studio/src"),
  join(repoRoot, "Aether CAD/src"),
  join(repoRoot, "Aether CAD/src/react"),
  join(repoRoot, "aether-map/src"),
];
//: Nothing pending: every product stylesheet in these roots is tokenised
//: (Aether CAD's style.css and shapr-shell.css were the last two, 2026-09-29).
//: A name listed here is a file the guard skips, so add one only with a note
//: saying why and when it comes back.
const PENDING = new Set();
const colorPattern = /#[0-9a-fA-F]{3,8}\b|rgba?\(/;
let violations = 0;
for (const root of roots) {
  for (const file of readdirSync(root).filter((name) => name.endsWith(".css"))) {
    if (PENDING.has(file)) continue;
    const path = join(root, file);
    readFileSync(path, "utf8").split("\n").forEach((line, index) => {
      const trimmed = line.trim().replace(/var\([^)]*\)/g, "var()");
      if (!colorPattern.test(trimmed)) return;
      if (trimmed.startsWith("--")) return;
      if (trimmed.includes("literal-ok")) return;
      violations += 1;
      console.log(`${path}:${index + 1}: ${trimmed}`);
    });
  }
}
// Every token a core/ui stylesheet or component reads must exist in the generated
// default theme, so a renamed token cannot silently fall back to nothing.
const tokensCSS = readFileSync(join(repoRoot, "core/ui/tokens/tokens.css"), "utf8");
const defined = new Set([...tokensCSS.matchAll(/--aether-[a-z0-9-]+(?=:)/g)].map((m) => m[0]));
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(dir, e.name)) : /\.(css|tsx)$/.test(e.name) ? [join(dir, e.name)] : []);
const missing = new Map();
for (const file of [...walk(join(repoRoot, "core/ui/src")), ...walk(join(repoRoot, "core/ui/gallery"))]) {
  for (const m of readFileSync(file, "utf8").matchAll(/var\((--aether-[a-z0-9-]+)/g)) if (!defined.has(m[1]) && !m[1].startsWith("--aether-feature-window-")) missing.set(m[1], file.slice(repoRoot.length + 1));
}
for (const [name, file] of missing) { console.log(`${file}: reads ${name}, which no theme defines`); violations += 1; }

// Motion is theme data too (Jonathan, 2026-09-30). A transition that names its
// own duration cannot be slowed by a theme and, more importantly, is not
// stilled by the reduced-motion block, which works by collapsing the duration
// tokens. Checked per comma-separated part, because a declaration that
// tokenises one property and hard-codes the next is how this drifts back.
const MOTION_DECL = /(?:transition|animation)(?:-duration)?\s*:\s*([^;}]+)/g;
const MOTION_LITERAL = /(?:^|[\s,(])(\d*\.?\d+)(m?s)\b/;
let stray = 0;
for (const root of roots) {
  for (const file of readdirSync(root).filter((name) => name.endsWith(".css"))) {
    if (PENDING.has(file)) continue;
    const path = join(root, file);
    for (const decl of readFileSync(path, "utf8").matchAll(MOTION_DECL)) {
      for (const part of decl[1].split(",")) {
        if (part.includes("--aether-motion")) continue;
        if (/\bnone\b|\binherit\b|\binitial\b|\bunset\b|infinite|!important/.test(part)) continue;
        if (!MOTION_LITERAL.test(part)) continue;
        console.log(`${path}: hard-coded motion \`${part.trim().slice(0, 60)}\``);
        stray += 1;
      }
    }
  }
}
if (stray) console.error(`\n${stray} hard-coded duration(s) — use var(--aether-motion-fast|base|slow) with var(--aether-motion-ease*).`);
violations += stray;

if (violations) {
  console.error(`\n${violations} theme violation(s) — route colour and motion through --aether-* variables.`);
  process.exit(1);
}
console.log("No raw color literals outside theme variable declarations; no hard-coded motion.");

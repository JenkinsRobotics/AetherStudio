import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compareBoundaries, dependencySpecifiers, scanBoundaries } from "./package-boundaries.mjs";

test("recognizes static, type, dynamic, require, URL and glob dependencies", () => {
  const source = [
    'import type { Thing } from "../../platform/types";',
    'export { Button } from "@aether/ui";',
    'import "../styles.css";',
    'const module = import("../../app/entry");',
    'const old = require("../../other/module");',
    'new URL("../../assets/logo.svg", import.meta.url);',
    'import.meta.glob(["../../assets/*.svg", "!../../assets/private.svg"]);',
    'import.meta.glob<Record<string, unknown>>("../../assets/*.json", { eager: true });',
  ].join("\n");
  assert.deepEqual(dependencySpecifiers(source), ["../../platform/types", "@aether/ui", "../styles.css", "../../app/entry", "../../other/module", "../../assets/logo.svg", "../../assets/*.svg", "!../../assets/private.svg", "../../assets/*.json"]);
});

test("does not treat comments, quoted examples or computed imports as edges", () => {
  assert.deepEqual(dependencySpecifiers(`// import "../../comment";
    /* export * from '../../comment' */
    const example = 'import "../../example"';
    const example2 = \`import "../../template"\`;
    import(variable); import(\`../../dynamic/\${name}\`);
  `), []);
  assert.deepEqual(dependencySpecifiers('/* url(../../ignored) */ @import "../../styles.css"; a { background: url("../../art.svg") }', ".css"), ["../../styles.css", "../../art.svg"]);
});

test("rejects a deliberately introduced crossing and records exact debt, including duplicates", () => {
  const root = mkdtempSync(join(tmpdir(), "aether-boundary-test-"));
  try {
    mkdirSync(join(root, "app/src"), { recursive: true });
    mkdirSync(join(root, "platform"));
    const source = join(root, "app/src/view.ts");
    writeFileSync(source, 'import "./local"; import "@aether/ui";');
    assert.deepEqual(scanBoundaries(root, ["app", "platform"]), {});
    writeFileSync(source, 'import "../../platform/secret";');
    const actual = scanBoundaries(root, ["app", "platform"]);
    const key = "app/src/view.ts → ../../platform/secret";
    assert.deepEqual(compareBoundaries(actual, {}).added, [key]);
    assert.deepEqual(compareBoundaries(actual, actual), { added: [], removed: [] });
    assert.deepEqual(compareBoundaries({}, actual).removed, [key]);
    assert.deepEqual(compareBoundaries({ [key]: 2 }, actual).added, [key]);
    assert.deepEqual(compareBoundaries({ [key + "-different"]: 1 }, actual).added, [key + "-different"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

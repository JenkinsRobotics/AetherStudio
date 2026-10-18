import { expect, test } from "vitest";
import { aetherIconNames } from "./AetherIcon";
import { graphiteToolIconNames, toolIconNames } from "./ToolIcon";

// Every icon a showcase widget or demo catalogue names must exist in a pack:
// the system pack (core/assets/icons) or an illustrated tool pack. A name in
// neither renders an empty glyph, which this catches at test time instead of
// in a browser.
const sources = import.meta.glob<string>(["../gallery/**/*.{ts,tsx}", "./**/*.{ts,tsx}"], { query: "?raw", import: "default", eager: true });

/** A name passed straight to an icon component or an `icon:` field. */
const PROPS = [
  /<(?:Sym|ToolGlyph|AetherIcon|ToolIcon)\b[^>]*?\sname="([a-z0-9_-]+)"/g,
  /\b[a-zA-Z]*[iI]con(?:Name)?[:=]\s*\{?"([a-z0-9_-]+)"/g,
  /\btool\("([a-z0-9_-]+)"/g,
];

/**
 * Names that reach an icon through data: a literal table mapped onto an icon
 * component, either bare names or [label, icon] pairs. Only tables whose map
 * body actually renders an icon are read, so ordinary string arrays are left
 * alone. The ported ribbon catalogue's `symbol` field is metadata the UI Dev
 * ribbon never renders, so it is deliberately not scanned.
 */
const ICON_TABLE = /\[((?:\s*(?:\[[^\]]*\]|"[a-z0-9_.-]+")\s*,?)+)\]\s*\.map\([\s\S]{0,320}?(?:Sym|ToolGlyph|AetherIcon|ToolIcon)\b/g;

test("every icon name the showcase uses is in a pack", () => {
  const known = new Set<string>([...aetherIconNames, ...toolIconNames, ...graphiteToolIconNames]);
  const missing = new Map<string, string>();
  const note = (name: string, path: string) => { if (name && !known.has(name) && !missing.has(name)) missing.set(name, path); };
  for (const [path, source] of Object.entries(sources)) {
    if (path.endsWith(".test.tsx") || path.endsWith(".test.ts")) continue;
    for (const context of PROPS) for (const match of source.matchAll(context)) note(match[1], path);
    for (const table of source.matchAll(ICON_TABLE)) {
      // In a [label, icon] pair the icon is the last entry; a bare row is the name itself.
      for (const row of table[1].matchAll(/\[([^\]]*)\]|"([a-z0-9_.-]+)"/g)) {
        if (row[1] !== undefined) {
          const parts = [...row[1].matchAll(/"([a-z0-9_.-]+)"/g)].map((part) => part[1]);
          if (parts.length) note(parts[parts.length - 1], path);
        } else note(row[2], path);
      }
    }
  }
  expect([...missing.entries()].map(([name, path]) => `${name} (${path})`)).toEqual([]);
});

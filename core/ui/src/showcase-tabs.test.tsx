import { describe, expect, it } from "vitest";
import { SHOWCASE_TABS, sectionTab } from "../gallery/showcase";
// Vite's ?raw import, as the icon files use it: the source as a string, no Node types needed.
import source from "../gallery/main.tsx?raw";

// The showcase filters sections by tab, so a section missing from the table
// would simply never render. Read the gallery source rather than mounting it:
// the check is about the table, not the widgets.
const rendered = [...source.matchAll(/<Section title="([^"]+)"/g)].map((match) => match[1]);
const filed = SHOWCASE_TABS.flatMap((tab) => tab.sections);

describe("showcase tabs", () => {
  it("file every rendered gallery section under exactly one tab", () => {
    expect(rendered.length).toBeGreaterThan(20);
    for (const title of rendered) expect(sectionTab(title), `"${title}" is not in SHOWCASE_TABS`).toBeDefined();
    expect(new Set(filed).size).toBe(filed.length);
  });

  it("list no section the gallery no longer renders", () => {
    for (const title of filed) expect(rendered, `"${title}" is in SHOWCASE_TABS but not rendered`).toContain(title);
  });

  it("open on Home, then go from atoms to applications", () => {
    expect(SHOWCASE_TABS.map((tab) => tab.id)).toEqual(["home", "elements", "widgets", "windows", "apps", "icons"]);
  });
});

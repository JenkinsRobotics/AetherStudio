import { expect, test } from "vitest";
import { DEFAULT_THEME_ID, aetherThemes, aetherViewportThemes, resolveTheme, themeCSS } from "./themes";
import { activeAetherTheme, activeAetherViewportTheme, setAetherTheme, setAetherViewportTheme } from "./StudioChrome";

const sources = import.meta.glob<string>(["./**/*.css", "./**/*.tsx"], { query: "?raw", import: "default", eager: true });
const tokensCSS = Object.values(import.meta.glob<string>("../tokens/tokens.css", { query: "?raw", import: "default", eager: true }))[0];
const keys = (t: (typeof aetherThemes)[number]) => [...Object.keys(t.modes.dark), ...Object.keys(t.modes.light), ...Object.keys(t.geometry), ...Object.keys(t.font), ...Object.keys(t.effects)].sort().join();

test("every theme in the pack resolves to the default's full token set, and tokens.css carries each one", () => {
  const base = aetherThemes[0];
  expect(base.id).toBe(DEFAULT_THEME_ID);
  expect(aetherThemes.length).toBeGreaterThan(3);
  for (const theme of aetherThemes) {
    expect(keys(theme), theme.id).toBe(keys(base));
    expect(tokensCSS).toMatch(new RegExp(`\\.aether-theme-${theme.id}[ ,]`));
    for (const alias of theme.aliases) expect(tokensCSS).toContain(`${alias} {`);
  }
  for (const viewport of aetherViewportThemes) {
    expect(tokensCSS).toContain(`.aether-viewport-${viewport.id} {`);
    for (const name of Object.keys({ ...viewport.modes.dark, ...viewport.modes.light })) expect(name.startsWith("viewport-"), `${viewport.id}: ${name}`).toBe(true);
  }
});

test("extends inherits every token and overrides only what the manifest names", () => {
  const studio = aetherThemes.find((t) => t.id === "aether-studio")!;
  const teal = resolveTheme({ id: "x", name: "X", extends: "aether-studio", modes: { dark: { "color-accent": "#123456" } } });
  expect(teal.modes.dark["color-accent"]).toBe("#123456");
  expect(teal.modes.dark["color-bg-app"]).toBe(studio.modes.dark["color-bg-app"]);
  expect(teal.font["font-family"]).toBe(studio.font["font-family"]);
  expect(() => resolveTheme({ id: "loop", name: "Loop", extends: "loop", modes: {} }, { loop: { id: "loop", name: "Loop", extends: "loop", modes: {} } })).toThrow();
});

test("the runtime install emits the same selectors the build does", () => {
  const css = themeCSS(aetherThemes.find((t) => t.id === "midnight")!);
  for (const selector of [".aether-theme-midnight {", ".aether-theme-midnight.aether-light-theme,", ".aether-light-theme .aether-theme-midnight {", ".aether-theme-midnight.aether-dark-theme,"]) {
    expect(css).toContain(selector);
    expect(tokensCSS).toContain(selector);
  }
});

test("every token a core/ui stylesheet reads is defined by the default theme", () => {
  const defined = new Set([...tokensCSS.matchAll(/--aether-[a-z0-9-]+(?=:)/g)].map((m) => m[0]));
  const missing = new Set<string>();
  for (const [file, source] of Object.entries(sources)) {
    for (const m of source.matchAll(/var\((--aether-[a-z0-9-]+)/g)) if (!defined.has(m[1])) missing.add(`${m[1]} (${file})`);
  }
  expect([...missing].sort()).toEqual([]);
});

test("choosing an interface theme and a viewport theme puts each on the root, independently", () => {
  const root = document.documentElement;
  setAetherTheme("midnight");
  expect(activeAetherTheme()).toBe("midnight");
  expect(root.classList.contains("aether-theme-midnight")).toBe(true);

  setAetherViewportTheme("blueprint");
  expect(activeAetherViewportTheme()).toBe("blueprint");
  expect(root.classList.contains("aether-viewport-blueprint")).toBe(true);
  // The interface theme is untouched by the viewport choice, and the reverse.
  expect(root.classList.contains("aether-theme-midnight")).toBe(true);

  setAetherTheme(DEFAULT_THEME_ID);
  expect([...root.classList].some((name) => name.startsWith("aether-theme-"))).toBe(false);
  expect(root.classList.contains("aether-viewport-blueprint")).toBe(true);

  setAetherViewportTheme(null);
  expect(activeAetherViewportTheme()).toBeNull();
  expect([...root.classList].some((name) => name.startsWith("aether-viewport-"))).toBe(false);
});

test("theme controls resolve the host fallback until an explicit browser choice is saved", () => {
  const root = document.documentElement;
  const saved = localStorage.getItem("aether-theme");
  const previousHost = root.dataset.aetherHostTheme;
  try {
    localStorage.removeItem("aether-theme");
    root.dataset.aetherHostTheme = "midnight";
    expect(activeAetherTheme()).toBe("midnight");
    setAetherTheme(DEFAULT_THEME_ID);
    expect(activeAetherTheme()).toBe(DEFAULT_THEME_ID);
    expect(root.classList.contains("aether-theme-midnight")).toBe(false);
    root.dataset.aetherHostTheme = "aether-studio";
    expect(activeAetherTheme()).toBe(DEFAULT_THEME_ID);
    localStorage.removeItem("aether-theme");
    expect(activeAetherTheme()).toBe("aether-studio");
  } finally {
    if (previousHost) root.dataset.aetherHostTheme = previousHost;
    else delete root.dataset.aetherHostTheme;
    if (saved) setAetherTheme(saved);
    else localStorage.removeItem("aether-theme");
  }
});


test("current themes use unified selection cells; a derived theme may opt into inset cells", () => {
  for (const theme of aetherThemes) {
    expect(theme.geometry["selection-cell-inset"], theme.id).toBe("0px");
    expect(theme.geometry["selection-cell-gap"], theme.id).toBe("0px");
    expect(theme.geometry["selection-cell-radius"], theme.id).toBe("0px");
  }
  const inset = resolveTheme({ id: "inset-cells", name: "Inset cells", extends: "aether-studio", modes: {}, geometry: {
    "selection-cell-inset": "4px", "selection-cell-gap": "3px", "selection-cell-radius": "6px",
  } });
  const css = themeCSS(inset);
  expect(css).toContain("--aether-selection-cell-inset: 4px;");
  expect(css).toContain("--aether-selection-cell-gap: 3px;");
  expect(css).toContain("--aether-selection-cell-radius: 6px;");
  expect(inset.modes.dark["color-accent"]).toBe(aetherThemes.find((t) => t.id === "aether-studio")!.modes.dark["color-accent"]);
});

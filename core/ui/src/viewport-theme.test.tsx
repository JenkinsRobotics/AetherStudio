import { expect, test } from "vitest";
import { parseCSSColor, viewportPalette } from "./viewport-theme";
import { aetherThemes, aetherViewportThemes } from "./themes";

test("parses the colour forms a theme manifest uses", () => {
  expect(parseCSSColor("#0d121b")).toEqual({ r: 13, g: 18, b: 27, a: 1 });
  expect(parseCSSColor("#abc")).toEqual({ r: 170, g: 187, b: 204, a: 1 });
  expect(parseCSSColor("rgba(255, 255, 255, 0.05)")).toEqual({ r: 255, g: 255, b: 255, a: 0.05 });
  expect(parseCSSColor("rgb(1 2 3)")).toEqual({ r: 1, g: 2, b: 3, a: 1 });
  for (const bad of ["", "   ", "not-a-colour", "#12", "rgb(1,2)"]) expect(parseCSSColor(bad)).toBeNull();
});

test("a solid background is the gradient's midpoint, and the grid keeps its alpha", () => {
  const palette = viewportPalette({
    "viewport-bg-top": "#20304a", "viewport-bg-bottom": "#00102a",
    "viewport-grid": "rgba(255, 255, 255, 0.1)", "viewport-selection": "#00ff00",
  });
  expect(palette.background?.hex).toBe(0x10203a);
  expect(palette.grid?.hex).toBe(0xffffff);
  expect(palette.grid?.alpha).toBeCloseTo(0.1);
  expect(palette.selection?.hex).toBe(0x00ff00);
  expect(palette.part).toBeUndefined();
});

test("every interface theme resolves a complete stage; a viewport theme may restyle only part of one", () => {
  for (const theme of aetherThemes) {
    for (const mode of ["dark", "light"] as const) {
      const palette = viewportPalette(theme.modes[mode]);
      for (const key of ["background", "grid", "part", "sketch", "selection"] as const) {
        expect(palette[key], `${theme.id} ${mode} ${key}`).toBeDefined();
      }
    }
  }
  // A viewport theme overrides only what it names; the rest cascades from the
  // interface theme, so it need only carry the stage itself.
  for (const theme of aetherViewportThemes) {
    for (const mode of ["dark", "light"] as const) {
      const palette = viewportPalette(theme.modes[mode]);
      expect(palette.background, `${theme.id} ${mode} background`).toBeDefined();
      expect(palette.grid, `${theme.id} ${mode} grid`).toBeDefined();
    }
  }
});

test("an empty or unparseable token set leaves the renderer its own defaults", () => {
  expect(viewportPalette({})).toEqual({});
  expect(viewportPalette({ "viewport-bg-top": "nonsense" })).toEqual({});
});

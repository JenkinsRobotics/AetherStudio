import { beforeEach, expect, test } from "vitest";
import { applyInterfaceColors, readInterfaceColors, setInterfaceColors, validateInterfaceColors } from "./InterfaceColors";
beforeEach(() => { localStorage.clear(); document.documentElement.dataset.aetherTheme = "light"; });
test("accepts only supported six-digit colors", () => {
  expect(validateInterfaceColors({ "bg-app": "#ABCDEF", accent: "red; color: red", unknown: "#123456" })).toEqual({ "bg-app": "#abcdef" });
});
test("persists separate modes and resets without losing the other mode", () => {
  setInterfaceColors("light", { "bg-app": "#eeeeee" });
  setInterfaceColors("dark", { "bg-app": "#222222" });
  expect(readInterfaceColors("light")).toEqual({ "bg-app": "#eeeeee" });
  expect(document.querySelector('[data-aether-custom-colors]')?.textContent).toContain('#eeeeee');
  document.documentElement.dataset.aetherTheme = "dark"; applyInterfaceColors();
  expect(document.querySelector('[data-aether-custom-colors]')?.textContent).toContain('#222222');
  setInterfaceColors("dark", {});
  expect(document.querySelector('[data-aether-custom-colors]')?.textContent).not.toContain('--aether-color-bg-app');
  expect(readInterfaceColors("light")["bg-app"]).toBe('#eeeeee');
});

test("recovers from malformed saved preferences", () => {
  localStorage.setItem("aether-interface-colors-v1", "{bad");
  expect(readInterfaceColors("light")).toEqual({});
  setInterfaceColors("light", {accent:"#123456"});
  expect(readInterfaceColors("light").accent).toBe("#123456");
});

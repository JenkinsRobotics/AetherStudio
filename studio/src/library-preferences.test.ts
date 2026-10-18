import { beforeEach, expect, test, vi } from "vitest";
import { defaultLibraryPreferences, readLibraryPreferences, writeLibraryPreferences } from "./library-preferences";
beforeEach(() => { const data = new Map<string,string>(); vi.stubGlobal("localStorage", {getItem:(key:string) => data.get(key) ?? null, setItem:(key:string,value:string) => data.set(key,value)}); });
test("validates corrupted and unknown preferences", () => {
  localStorage.setItem("aether-cad.library-preferences.v1", '{"lengthUnit":"bad","decimals":99,"startPage":"bad"}');
  expect(readLibraryPreferences("cad")).toEqual(defaultLibraryPreferences);
  localStorage.setItem("aether-cad.library-preferences.v1", 'null');
  expect(readLibraryPreferences("cad")).toEqual(defaultLibraryPreferences);
});
test("saves defaults per application", () => {
  writeLibraryPreferences("cad", {...defaultLibraryPreferences, lengthUnit:"in", destination:"workspace", startPage:"personal"});
  expect(readLibraryPreferences("cad").lengthUnit).toBe("in");
  expect(readLibraryPreferences("map")).toEqual(defaultLibraryPreferences);
});

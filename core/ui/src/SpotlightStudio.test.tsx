import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ComponentProps } from "react";
import type { SpotlightViewport } from "../gallery/spotlight-studio/SpotlightViewport";
import { SpotlightStudioDemo } from "../gallery/spotlight-studio/SpotlightStudioDemo";
import { SpotlightSpecimens } from "../gallery/spotlight-studio/SpotlightSpecimens";
import { initialLighting, studies, updateStudy } from "../gallery/spotlight-studio/state";
import { enclosure, disposeEnclosure } from "../gallery/spotlight-studio/geometry";
import { sectionTab } from "../gallery/showcase";

let viewport: ComponentProps<typeof SpotlightViewport>;
vi.mock("../gallery/spotlight-studio/SpotlightViewport", () => ({ SpotlightViewport: (props: ComponentProps<typeof SpotlightViewport>) => { viewport = props; return <div aria-label="Live rendering boundary"/>; } }));
vi.mock("./ViewportNavigationCube", () => ({ ViewportNavigationCube: () => <div aria-label="View cube"/> }));
beforeEach(() => vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const button = (name: string) => screen.getByRole("button", { name });
function enter(name: string, value: string) { const input = screen.getByRole("textbox", { name }); fireEvent.input(input, { target: { value } }); fireEvent.keyDown(input, { key: "Enter" }); }
test("geometry bounds preserve valid rounding and do not mutate prior studies", () => {
  const original = studies()[0], changed = updateStudy(original, { height: 10, radius: 100, width: NaN });
  expect(changed.radius).toBe(4.5); expect(changed.width).toBe(original.width); expect(original.radius).toBe(2.5);
  const mesh = enclosure(changed);
  expect(mesh.children).toHaveLength(2); expect(mesh.children.map(part => part.userData.part)).toEqual(["body", "lid"]);
  disposeEnclosure(mesh);
});
test("dimensions, rounding, part visibility and exploded lid reach the real renderer boundary", () => {
  render(<SpotlightStudioDemo/>); fireEvent.click(button("Shape")); enter("Length", "200"); enter("Edge radius", "6");
  expect(viewport.study.length).toBe(200); expect(viewport.study.radius).toBe(6);
  fireEvent.click(screen.getByRole("checkbox", { name: "Separate lid" })); expect(viewport.study.exploded).toBe(true);
  fireEvent.click(button("Hide Body")); expect(viewport.study.body).toBe(false);
  act(() => viewport.onSelect("lid")); expect(viewport.selected).toBe("lid");
});
test("document tabs retain independent edited studies", () => {
  render(<SpotlightStudioDemo/>); fireEvent.click(button("Shape")); enter("Length", "210");
  fireEvent.click(screen.getByRole("tab", { name: /Matchbox/ })); expect(viewport.study.length).toBe(84);
  enter("Length", "90"); fireEvent.click(screen.getByRole("tab", { name: /Enclosure study/ })); expect(viewport.study.length).toBe(210);
  fireEvent.click(button("Reset this study")); expect(viewport.study.length).toBe(160);
  fireEvent.click(screen.getByRole("tab", { name: /Matchbox/ })); expect(viewport.study.length).toBe(90);
});
test("lighting presets, individual light controls, surfaces and view toggles are functional", () => {
  render(<SpotlightStudioDemo/>); fireEvent.click(button("Lighting"));
  fireEvent.click(screen.getByRole("radio", { name: "Rim light" })); expect(viewport.lighting.azimuth).toBe(50);
  fireEvent.change(screen.getByRole("slider", { name: "Light power" }), { target: { value: "100" } }); expect(viewport.lighting.power).toBe(100);
  fireEvent.click(screen.getByRole("radio", { name: "Spotlight" })); expect(viewport.lighting).toEqual(initialLighting);
  fireEvent.click(button("Surface")); fireEvent.click(button("Apply Ceramic")); expect(viewport.study.metalness).toBe(.05);
  fireEvent.click(screen.getByRole("checkbox", { name: "Ground grid" })); expect(viewport.grid).toBe(false);
  fireEvent.click(screen.getByRole("checkbox", { name: "Wireframe" })); expect(viewport.wireframe).toBe(true);
  fireEvent.click(button("Turntable")); expect(viewport.turntable).toBe(true);
});
test("composed widgets are reviewed independently under Widgets", () => {
  expect(sectionTab("Trees + hierarchies — every variant side by side")).toBe("widgets"); render(<><SpotlightSpecimens kind="trees"/><SpotlightSpecimens kind="appearance"/></>);
  expect(screen.getByRole("tree", { name: "Study features" })).toBeTruthy();
  expect(screen.getByRole("slider", { name: "Light direction" })).toBeTruthy();
  expect(screen.queryByRole("link")).toBeNull();
});

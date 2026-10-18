import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ComponentProps } from "react";
import * as THREE from "three";
import type { WheelViewport } from "../gallery/wheel-studio/WheelViewport";
import { WheelStudioDemo } from "../gallery/wheel-studio/WheelStudioDemo";
import { WheelSpecimens } from "../gallery/wheel-studio/WheelSpecimens";
import { initialWheel, updateWheel } from "../gallery/wheel-studio/state";
import { disposeWheel, MM_PER_UNIT, wheelModel } from "../gallery/wheel-studio/geometry";
import { sectionTab } from "../gallery/showcase";
let viewport: ComponentProps<typeof WheelViewport>;
vi.mock("../gallery/wheel-studio/WheelViewport", () => ({ WheelViewport: (props: ComponentProps<typeof WheelViewport>) => { viewport = props; return <div aria-label="Live wheel rendering boundary"/>; } }));
vi.mock("./ViewportNavigationCube", () => ({ ViewportNavigationCube: () => <div aria-label="View cube"/> }));
beforeEach(() => vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const button = (name: string) => screen.getByRole("button", { name });
function enter(name: string, value: string) { const field = screen.getByRole("textbox", { name }); fireEvent.input(field, { target: { value } }); fireEvent.keyDown(field, { key: "Enter" }); }
test("wheel parameter bounds keep bore, flange and rounding valid after diameter changes", () => {
  const next = updateWheel(initialWheel, { diameter: 180, width: 1000, bore: 150, flange: 100, rounding: 20, opacity: -1 });
  expect(next.width).toBe(90); expect(next.bore).toBeCloseTo(39.6); expect(next.flange).toBeCloseTo(21.6); expect(next.rounding).toBeCloseTo(5.4); expect(next.opacity).toBe(.1);
  expect(updateWheel(initialWheel, { width: NaN }).width).toBe(120); expect(initialWheel.diameter).toBe(400);
});
test("wheel has a through bore and bounded extent; assembly adds a mirrored wheel and axle", () => {
  const part = wheelModel(initialWheel), mesh = part.children[0] as THREE.Mesh;
  mesh.geometry.computeBoundingBox(); expect(mesh.geometry.boundingBox!.max.x * MM_PER_UNIT).toBeCloseTo(224, 0);
  const position = mesh.geometry.getAttribute("position"); let minimumRadius = Infinity;
  for (let i=0;i<position.count;i++) minimumRadius = Math.min(minimumRadius, Math.hypot(position.getX(i),position.getY(i)));
  expect(minimumRadius * MM_PER_UNIT).toBeCloseTo(initialWheel.bore / 2, 3);
  const assembly = wheelModel(initialWheel, true), pieces = assembly.children.filter(child => child instanceof THREE.Mesh);
  expect(pieces.map(piece => piece.userData.part)).toEqual(["wheel", "wheel", "axle"]); expect(pieces[0].position.z).toBe(-pieces[1].position.z);
  disposeWheel(part); disposeWheel(assembly);
});
test("profile edits reach the renderer and assembly shares the edited wheel", () => {
  render(<WheelStudioDemo/>); fireEvent.click(button("Profile")); enter("Tread diameter", "520"); enter("Width", "140");
  expect(viewport.study.diameter).toBe(520); expect(viewport.study.width).toBe(140);
  fireEvent.click(screen.getByRole("tab", { name: /Wheelset assembly/ })); expect(viewport.assembly).toBe(true); expect(viewport.study.diameter).toBe(520);
  fireEvent.click(button("Rounding")); enter("Edge radius", "5"); expect(viewport.study.rounding).toBe(5);
  fireEvent.click(button("Hide Wheel pair")); expect(viewport.study.visible).toBe(false);
  fireEvent.click(button("Reset wheel")); expect(viewport.study).toEqual(initialWheel);
});
test("material, opacity, cutaway and display controls update the renderer", () => {
  render(<WheelStudioDemo/>);
  fireEvent.change(screen.getByRole("combobox", { name: "Material" }), { target: { value: "Bronze" } }); expect(viewport.study.color).toBe("#b59062");
  fireEvent.change(screen.getByRole("slider", { name: "Opacity" }), { target: { value: "55" } }); expect(viewport.study.opacity).toBe(.55);
  fireEvent.click(button("Cutaway")); expect(viewport.display.section).toBe(true);
  fireEvent.click(screen.getByRole("checkbox", { name: "Show edges" })); expect(viewport.display.edges).toBe(false);
  fireEvent.change(screen.getByRole("combobox", { name: "Viewport shading" }), { target: { value: "wireframe" } }); expect(viewport.display.wireframe).toBe(true);
  fireEvent.click(button("Lighting")); fireEvent.change(screen.getByRole("slider", { name: "Light direction" }), { target: { value: "160" } }); expect(viewport.lighting.azimuth).toBe(160);
  act(() => viewport.onSelect("wheel")); expect(viewport.selected).toBe("wheel"); expect(screen.getByRole("textbox", { name: "Part name" })).toBeTruthy();
});
test("notes and names remain editable while switching inspector views", () => {
  render(<WheelStudioDemo/>); fireEvent.change(screen.getByRole("textbox", { name: "Part name" }), { target: { value: "Wheel B" } }); expect(viewport.study.name).toBe("Wheel B");
  fireEvent.click(screen.getByRole("radio", { name: "Notes" })); fireEvent.change(screen.getByRole("textbox", { name: "Design notes" }), { target: { value: "Review the flange" } });
  fireEvent.click(screen.getByRole("radio", { name: "Appearance" })); fireEvent.click(button("Apply Brushed Steel")); expect(viewport.study.metalness).toBe(.94);
  fireEvent.click(screen.getByRole("radio", { name: "Notes" })); expect((screen.getByRole("textbox", { name: "Design notes" }) as HTMLTextAreaElement).value).toBe("Review the flange");
});
test("wheel widgets are independently reviewable without demo launcher links", () => {
  expect(sectionTab("Trees + hierarchies — every variant side by side")).toBe("widgets"); render(<><WheelSpecimens kind="trees"/><WheelSpecimens kind="inspectors"/></>);
  expect(screen.getByRole("tree", { name: "Wheel features" })).toBeTruthy(); expect(screen.getByRole("textbox", { name: "Tread diameter" })).toBeTruthy(); expect(screen.queryByRole("link")).toBeNull();
});

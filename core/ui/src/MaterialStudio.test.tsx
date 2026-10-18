import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ComponentProps } from "react";
import type { StudioViewport } from "../gallery/material-studio/StudioViewport";
import { MaterialStudioDemo } from "../gallery/material-studio/MaterialStudioDemo";
import { StudioWidgetSpecimens } from "../gallery/material-studio/StudioSpecimens";
import { initialObjects, nextPreviewTime } from "../gallery/material-studio/state";
import { sectionTab } from "../gallery/showcase";

let viewport: ComponentProps<typeof StudioViewport>;
vi.mock("../gallery/material-studio/StudioViewport", () => ({ StudioViewport: (props: ComponentProps<typeof StudioViewport>) => { viewport = props; return <div aria-label="Renderer boundary"/>; } }));
beforeEach(() => { vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const button = (name: string) => screen.getByRole("button", { name });
function enter(name: string, value: string) { const input = screen.getByRole("textbox", { name }); fireEvent.input(input, { target: { value } }); fireEvent.keyDown(input, { key: "Enter" }); fireEvent.blur(input); }

test("material assignment, parameter edits, visibility and undo/redo reach the renderer", () => {
  render(<MaterialStudioDemo/>);
  fireEvent.click(within(screen.getByRole("region", { name: "Material presets" })).getByRole("button", { name: "Brushed gold" }));
  expect(viewport.objects[0].material).toBe("gold");
  fireEvent.change(screen.getByRole("slider", { name: "Roughness" }), { target: { value: ".65" } });
  expect(viewport.materials.find(item => item.id === "gold")!.roughness).toBe(.65);
  fireEvent.click(button("Hide Head study")); expect(viewport.objects[0].visible).toBe(false);
  fireEvent.click(button("Undo")); expect(viewport.objects[0].visible).toBe(true);
  fireEvent.click(button("Redo")); expect(viewport.objects[0].visible).toBe(false);
  fireEvent.click(screen.getByRole("checkbox", { name: "Key light" })); expect(viewport.lights.key).toBe(false);
});

test("primitive selection, transforms, reset, wireframe and seeking share one app state", () => {
  render(<MaterialStudioDemo/>);
  fireEvent.click(button("Add cube")); expect(viewport.selected).toBe("cube"); expect(viewport.objects[1].visible).toBe(true);
  enter("position X", "125"); expect(viewport.objects[1].transform.position).toEqual([125, -80, 0]);
  fireEvent.click(button("Undo")); expect(viewport.objects[1].transform.position[0]).toBe(200);
  fireEvent.click(button("Redo")); expect(viewport.objects[1].transform.position[0]).toBe(125);
  fireEvent.click(button("Reset")); expect(viewport.objects[1].transform.position).toEqual([0, 0, 0]);
  fireEvent.click(button("Undo")); expect(viewport.objects[1].transform.position[0]).toBe(125);
  fireEvent.click(button("Wireframe")); expect(viewport.wireframe).toBe(true);
  fireEvent.pointerDown(button("Turntable keyframe at 5.00s")); expect(viewport.time).toBe(5);
  fireEvent.click(button("Move object")); expect(viewport.time).toBe(0); expect(viewport.tool).toBe("translate");
});

test("independent specimens retain editable controls and correct catalogue ownership", () => {
  render(<><StudioWidgetSpecimens kind="appearance"/><StudioWidgetSpecimens kind="inspectors"/><StudioWidgetSpecimens kind="timelines"/></>);
  fireEvent.click(button("Chrome")); expect((screen.getByRole("textbox", { name: "Material name" }) as HTMLInputElement).value).toBe("Chrome");
  enter("rotation Y", "45"); expect((screen.getByRole("textbox", { name: "rotation Y" }) as HTMLInputElement).value).toBe("45.0");
  fireEvent.click(button("Last frame")); expect((screen.getByRole("textbox", { name: "Preview time" }) as HTMLInputElement).value).toBe("10.00");
  expect(sectionTab("Appearance, materials + visualization — every variant side by side")).toBe("widgets"); expect(sectionTab("Material swatches")).toBe("elements");
});

test("turntable boundaries stop or loop without changing fresh scene defaults", () => {
  expect(nextPreviewTime(9.95, .1, false)).toBe(10);
  expect(nextPreviewTime(9.95, .1, true)).toBeCloseTo(.05);
  expect(nextPreviewTime(5, -1, false)).toBe(5);
  const objects = initialObjects(); objects[0].transform.position[0] = 100;
  expect(initialObjects()[0].transform.position).toEqual([0, 0, 0]);
});

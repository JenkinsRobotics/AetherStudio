import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { DimensionedSketch } from "./DimensionedSketch";
import { DimensionedSketchDemo } from "../gallery/DimensionedSketchDemo";
import { dimensionedSketchSample, initialSketchSample, SAMPLE_VIEW, sketchSampleProblem } from "../gallery/dimensioned-sketch-example";
import { SHOWCASE_COLLECTIONS } from "../gallery/showcase/collections";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const fixture = () => dimensionedSketchSample(initialSketchSample());
function editValue(value: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Dimension value" }), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
}

test("selection and keyboard activation identify dimensions, geometry and constraints", () => {
  const select = vi.fn(), edit = vi.fn();
  const { rerender } = render(<DimensionedSketch {...SAMPLE_VIEW} {...fixture()} selection={null} onSelect={select} onEditDimension={edit} />);
  const cap = screen.getByRole("button", { name: /^Cap radius:/ });
  fireEvent.click(cap); expect(select).toHaveBeenLastCalledWith({ kind: "dimension", id: "cap" });
  fireEvent.keyDown(cap, { key: "Enter" }); expect(edit).toHaveBeenLastCalledWith("cap");
  fireEvent.keyDown(screen.getByRole("button", { name: "Seat arc" }), { key: " " }); expect(select).toHaveBeenLastCalledWith({ kind: "entity", id: "seat" });
  fireEvent.click(screen.getByRole("button", { name: "Tangent: left working arc and seat" })); expect(select).toHaveBeenLastCalledWith({ kind: "constraint", id: "tangent-left" });
  rerender(<DimensionedSketch {...SAMPLE_VIEW} {...fixture()} selection={{ kind: "constraint", id: "tangent-left" }} onSelect={select} />);
  expect(screen.getByRole("button", { name: "Seat arc" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "Left working arc" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.keyDown(cap, { key: "Escape" }); expect(select).toHaveBeenLastCalledWith(null);
});

test("keyboard label movement is controlled, bounded and leaves supplied geometry unchanged", () => {
  const move = vi.fn(), scene = fixture();
  render(<DimensionedSketch {...SAMPLE_VIEW} {...scene} selection={null} onSelect={vi.fn()} onMoveLabel={move} />);
  const cap = screen.getByRole("button", { name: /^Cap radius:/ });
  fireEvent.keyDown(cap, { key: "ArrowRight", shiftKey: true }); expect(move).toHaveBeenLastCalledWith("cap", [635, 77]);
  const offset = screen.getByRole("button", { name: /^Center offset:/ });
  fireEvent.keyDown(offset, { key: "ArrowUp", shiftKey: true }); expect(move).toHaveBeenLastCalledWith("offset", [412, 24]);
  expect(cap.getAttribute("transform")).toBe("translate(625 77)");
});

test("pointer capture stays on the label for double-click editing and commits one drag transaction", () => {
  class TestPointerEvent extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; }
  }
  vi.stubGlobal("PointerEvent", TestPointerEvent);
  const move = vi.fn(), edit = vi.fn();
  render(<DimensionedSketch {...SAMPLE_VIEW} {...fixture()} selection={null} onSelect={vi.fn()} onMoveLabel={move} onEditDimension={edit} />);
  const canvas = screen.getByRole("group", { name: "Dimensioned sketch" }), label = screen.getByRole("button", { name: /^Cap radius:/ });
  const capture = vi.fn(), rootCapture = vi.fn(), release = vi.fn();
  Object.defineProperties(label, { setPointerCapture: { value: capture }, hasPointerCapture: { value: () => true }, releasePointerCapture: { value: release } });
  Object.defineProperty(canvas, "setPointerCapture", { value: rootCapture });
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 900, bottom: 800, width: 900, height: 800, toJSON: () => ({}) });
  fireEvent.pointerDown(label, { pointerId: 7, button: 0, clientX: 625, clientY: 77 });
  expect(capture).toHaveBeenCalledWith(7); expect(rootCapture).not.toHaveBeenCalled();
  fireEvent.pointerMove(canvas, { pointerId: 7, clientX: 650, clientY: 90 });
  expect(move).not.toHaveBeenCalled(); expect(label.getAttribute("transform")).toBe("translate(650 90)");
  fireEvent.pointerUp(canvas, { pointerId: 7, clientX: 650, clientY: 90 });
  expect(move).toHaveBeenCalledExactlyOnceWith("cap", [650, 90]); expect(release).toHaveBeenCalledWith(7);
  fireEvent.doubleClick(label); expect(edit).toHaveBeenCalledWith("cap");
  fireEvent.pointerDown(label, { pointerId: 8, button: 0, clientX: 625, clientY: 77 });
  fireEvent.pointerMove(canvas, { pointerId: 8, clientX: 660, clientY: 100 });
  fireEvent.pointerCancel(canvas, { pointerId: 8 });
  expect(move).toHaveBeenCalledTimes(1); expect(label.getAttribute("transform")).toBe("translate(625 77)");
});

test("visibility removes hidden geometry and constraints from keyboard access, with unique marker IDs per canvas", () => {
  const { container } = render(<><DimensionedSketch {...SAMPLE_VIEW} {...fixture()} selection={null} onSelect={vi.fn()} showConstruction={false} showConstraints={false} showReferences={false} /><DimensionedSketch {...SAMPLE_VIEW} {...fixture()} selection={null} onSelect={vi.fn()} /></>);
  const canvases = screen.getAllByRole("group", { name: "Dimensioned sketch" });
  expect(within(canvases[0]).queryByRole("button", { name: "Blank construction arc" })).toBeNull();
  expect(within(canvases[0]).queryByRole("button", { name: /^Tangent: / })).toBeNull();
  expect(canvases[0].querySelectorAll(".aui-sketch-expression")).toHaveLength(0);
  const ids = [...container.querySelectorAll("defs [id]")].map(node => node.id); expect(new Set(ids).size).toBe(ids.length);
});

test("the sample starts valid and measured tangent offsets agree with its actual seat radius", () => {
  const state = initialSketchSample(); expect(sketchSampleProblem(state.values)).toBeNull();
  const scene = dimensionedSketchSample(state);
  expect(Math.hypot(scene.measured.yH, scene.measured.Vb)).toBeCloseTo(state.values.Rseat, 10);
  expect(scene.measured.yH).toBeCloseTo(1.996724, 5);
  for (const p of scene.entities) expect(p.path).not.toMatch(/NaN|Infinity/);
  expect(SHOWCASE_COLLECTIONS.find(c => c.id === "app-cad")?.sections).toContain("Dimensioned sketches");
});

test("invalid values and impossible circle relationships are rejected before replacing geometry", () => {
  const values = initialSketchSample().values;
  expect(sketchSampleProblem({ ...values, RcapE: Infinity })).toMatch(/Cap radius/);
  expect(sketchSampleProblem({ ...values, Ework: 5 })).toMatch(/must exceed/);
  expect(sketchSampleProblem({ ...values, Rp: 21, RcapE: 23 })).toMatch(/above the shoulders/);
  render(<DimensionedSketchDemo />);
  const path = screen.getByRole("button", { name: "Cap arc" }).querySelector("path")!.getAttribute("d");
  editValue("1 / 0"); expect(screen.getByRole("alert").textContent).toMatch(/finite number/);
  editValue("100"); expect(screen.getByRole("alert").textContent).toMatch(/between 23 and 28/);
  expect(screen.getByRole("button", { name: "Cap arc" }).querySelector("path")!.getAttribute("d")).toBe(path);
  expect(screen.getByRole("button", { name: "Undo" }).hasAttribute("disabled")).toBe(true);
});

test("editing a shared reference changes both radius annotations, geometry and dependent measurements", () => {
  render(<DimensionedSketchDemo />);
  const path = screen.getByRole("button", { name: "Right working arc" }).querySelector("path")!.getAttribute("d");
  const horizontal = screen.getByRole("button", { name: /^Tangent horizontal distance:/ }).getAttribute("aria-label");
  fireEvent.click(screen.getByRole("button", { name: "Inspect Working radius" }));
  editValue("6 + 1");
  expect(screen.getByRole("button", { name: /^Left working radius: R7.00/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /^Right working radius: R7.00/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Right working arc" }).querySelector("path")!.getAttribute("d")).not.toBe(path);
  expect(screen.getByRole("button", { name: /^Tangent horizontal distance:/ }).getAttribute("aria-label")).not.toBe(horizontal);
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  expect(screen.getByRole("button", { name: /^Left working radius: R6.65/ })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Redo" }));
  expect(screen.getByRole("button", { name: /^Right working radius: R7.00/ })).toBeTruthy();
});

test("measured dimensions stay read-only, accept notes, and restore through undo and redo", () => {
  render(<DimensionedSketchDemo />);
  fireEvent.click(screen.getByRole("button", { name: "Inspect Tangent horizontal distance" }));
  expect(screen.getByRole("textbox", { name: "Dimension value" }).hasAttribute("readonly")).toBe(true);
  fireEvent.change(screen.getByRole("textbox", { name: "Dimension note" }), { target: { value: "Check clearance at the seat" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  expect((screen.getByRole("textbox", { name: "Dimension note" }) as HTMLInputElement).value).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "Redo" }));
  expect((screen.getByRole("textbox", { name: "Dimension note" }) as HTMLInputElement).value).toBe("Check clearance at the seat");
});

test("label position edits undo, restore and reset without losing reference attachment", () => {
  render(<DimensionedSketchDemo />);
  const label = screen.getByRole("button", { name: /^Cap radius:/ });
  fireEvent.keyDown(label, { key: "ArrowRight", shiftKey: true }); expect(label.getAttribute("transform")).toBe("translate(635 77)");
  fireEvent.click(screen.getByRole("button", { name: "Restore label" })); expect(label.getAttribute("transform")).toBe("translate(625 77)");
  editValue("27");
  fireEvent.click(screen.getByRole("button", { name: "Reset sketch" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" })); expect(screen.getByRole("button", { name: /^Cap radius: R27.00/ })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Reset sketch" }));
  fireEvent.click(screen.getByRole("button", { name: "Reset" })); expect(screen.getByRole("button", { name: /^Cap radius: R25.14/ })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Undo" })); expect(screen.getByRole("button", { name: /^Cap radius: R27.00/ })).toBeTruthy();
});

test("canvas controls change the view, fit and visibility without adding history edits", () => {
  render(<DimensionedSketchDemo />);
  const canvas = screen.getByRole("group", { name: "Dimensioned sketch" });
  fireEvent.click(screen.getByRole("button", { name: "Zoom in sketch" })); expect(canvas.getAttribute("viewBox")).not.toBe("0 0 900 800");
  fireEvent.click(screen.getByRole("button", { name: "Fit" })); expect(canvas.getAttribute("viewBox")).toBe("0 0 900 800");
  fireEvent.keyDown(canvas, { key: "ArrowRight" }); expect(canvas.getAttribute("viewBox")).toBe("20 0 900 800");
  fireEvent.click(screen.getByRole("button", { name: "Fit" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Construction" })); expect(screen.queryByRole("button", { name: "Blank construction arc" })).toBeNull();
  fireEvent.click(screen.getByRole("checkbox", { name: "Constraints" })); expect(screen.queryByRole("button", { name: "Tangent: left working arc and seat" })).toBeNull();
  expect(screen.getByRole("button", { name: "Undo" }).hasAttribute("disabled")).toBe(true);
});

test("Enter opens the dimension input, and text undo remains native to the input", () => {
  render(<DimensionedSketchDemo />);
  fireEvent.keyDown(screen.getByRole("button", { name: /^Seat radius:/ }), { key: "Enter" });
  const input = screen.getByRole("textbox", { name: "Dimension value" }); expect(document.activeElement).toBe(input);
  editValue("2.8");
  expect(fireEvent.keyDown(input, { key: "z", ctrlKey: true })).toBe(true);
  expect(screen.getByRole("button", { name: /^Seat radius: R2.80/ })).toBeTruthy();
  fireEvent.keyDown(screen.getByRole("group", { name: "Dimensioned sketch" }), { key: "z", ctrlKey: true });
  expect(screen.getByRole("button", { name: /^Seat radius: R2.59/ })).toBeTruthy();
});

import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { bindViewportPointerActions } from "../gallery/plasticity-studio/viewport-pointer-actions";

let canvas: HTMLCanvasElement, dispose: () => void;
const pick = vi.fn(), menu = vi.fn();
function pointer(type: string, x = 100, y = 100, button = 2, extra: Record<string, unknown> = {}) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button, ...extra });
  Object.defineProperty(event, "pointerId", { value: extra.pointerId ?? 1 });
  canvas.dispatchEvent(event);
}
function context() {
  const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 });
  canvas.dispatchEvent(event); expect(event.defaultPrevented).toBe(true);
}
beforeEach(() => {
  pick.mockClear(); menu.mockClear(); canvas = document.createElement("canvas"); document.body.append(canvas);
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 } as DOMRect);
  dispose = bindViewportPointerActions(canvas, { pick, menu });
});
afterEach(() => { dispose(); canvas.remove(); });

test.each(["press", "release"])("a right drag suppresses a %s-time contextmenu", timing => {
  pointer("pointerdown"); if (timing === "press") context(); expect(menu).not.toHaveBeenCalled();
  pointer("pointermove", 150, 120); pointer("pointerup", 150, 120); if (timing === "release") context();
  expect(menu).not.toHaveBeenCalled(); expect(pick).not.toHaveBeenCalled();
});
test.each(["press", "release"])("a stationary right click opens once after release with a %s-time contextmenu", timing => {
  pointer("pointerdown"); if (timing === "press") context(); expect(menu).not.toHaveBeenCalled();
  pointer("pointerup", 102, 101); if (timing === "release") context();
  expect(menu).toHaveBeenCalledExactlyOnceWith(102, 101); expect(pick).not.toHaveBeenCalled();
});
test("returning to the start after a drag is still a drag", () => {
  pointer("pointerdown"); pointer("pointermove", 140); pointer("pointermove"); pointer("pointerup"); context();
  expect(menu).not.toHaveBeenCalled();
});
test.each(["pointercancel", "blur"])("%s cancels the pending click", event => {
  pointer("pointerdown"); window.dispatchEvent(new Event(event)); pointer("pointerup"); context(); expect(menu).not.toHaveBeenCalled();
  pointer("pointerdown"); pointer("pointerup"); expect(menu).toHaveBeenCalledTimes(1);
});
test("left clicks select or measure, while navigation drags and secondary pointers never pick", () => {
  pointer("pointerdown", 100, 100, 0); pointer("pointerup", 100, 100, 0); expect(pick).toHaveBeenCalledTimes(1);
  pointer("pointerdown", 100, 100, 0); pointer("pointermove", 150, 100, 0); pointer("pointerup", 100, 100, 0);
  pointer("pointerdown", 100, 100, 0); pointer("pointerdown", 200, 100, 0, { pointerId: 2 }); pointer("pointerup", 100, 100, 0);
  expect(pick).toHaveBeenCalledTimes(1); expect(menu).not.toHaveBeenCalled();
});
test("Control-click and keyboard context menus remain available", () => {
  pointer("pointerdown", 100, 100, 0, { ctrlKey: true }); context(); expect(menu).not.toHaveBeenCalled();
  pointer("pointerup", 100, 100, 0, { ctrlKey: true }); expect(menu).toHaveBeenCalledExactlyOnceWith(100, 100);
  canvas.dispatchEvent(new KeyboardEvent("keydown", { key: "F10", shiftKey: true, bubbles: true }));
  expect(menu).toHaveBeenLastCalledWith(400, 300); expect(pick).not.toHaveBeenCalled();
});
test("release outside the canvas and disposed listeners cannot open a menu", () => {
  pointer("pointerdown", 799); pointer("pointerup", 802); expect(menu).not.toHaveBeenCalled();
  pointer("pointerdown"); dispose(); pointer("pointerup"); expect(menu).not.toHaveBeenCalled();
});

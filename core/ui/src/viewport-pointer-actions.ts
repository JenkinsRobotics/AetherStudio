/** Separate clicks from navigation gestures without intercepting OrbitControls. */
export function bindViewportPointerActions(canvas: HTMLCanvasElement, actions: {
  pick: (event: PointerEvent) => void;
  menu: (x: number, y: number) => void;
}) {
  let gesture: { id: number; button: number; x: number; y: number; moved: boolean; context: boolean } | null = null;
  const cancel = () => { gesture = null; };
  const down = (event: PointerEvent) => {
    // A second pointer means a multi-touch gesture, never a click.
    if (gesture) { cancel(); return; }
    gesture = { id: event.pointerId, button: event.button, x: event.clientX, y: event.clientY,
      moved: false, context: event.button === 2 || (event.button === 0 && event.ctrlKey) };
  };
  const move = (event: PointerEvent) => {
    if (gesture?.id === event.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 4) gesture.moved = true;
  };
  const up = (event: PointerEvent) => {
    if (!gesture || gesture.id !== event.pointerId) return;
    move(event);
    const finished = gesture; cancel();
    if (finished.moved || event.button !== finished.button) return;
    const rect = canvas.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
    if (finished.context) actions.menu(event.clientX, event.clientY);
    else if (finished.button === 0) actions.pick(event);
  };
  // Browsers can emit contextmenu on press or release. Neither event proves a click.
  const context = (event: MouseEvent) => { event.preventDefault(); };
  const key = (event: KeyboardEvent) => {
    if (event.key !== "ContextMenu" && !(event.key === "F10" && event.shiftKey)) return;
    event.preventDefault(); cancel();
    const rect = canvas.getBoundingClientRect(); actions.menu(rect.left + rect.width / 2, rect.top + rect.height / 2);
  };
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("contextmenu", context);
  canvas.addEventListener("keydown", key);
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
  window.addEventListener("blur", cancel);
  return () => {
    cancel();
    canvas.removeEventListener("pointerdown", down);
    canvas.removeEventListener("contextmenu", context);
    canvas.removeEventListener("keydown", key);
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("blur", cancel);
  };
}

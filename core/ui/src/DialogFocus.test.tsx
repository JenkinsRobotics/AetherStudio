import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, test } from "vitest";
import { NewFileDialog } from "./NewFileDialog";

/**
 * Jonathan, 2026-10-03, creating a file in Aether Map: "every letter then
 * deselects the input field, requiring me to click twice every letter."
 *
 * The cause is in `Dialog`, not here: its focus-management effect listed
 * `onClose` in its dependencies, and every caller passes an inline arrow. A
 * keystroke re-renders, the arrow's identity changes, the effect tears down —
 * returning focus to the opener — and re-runs, focusing the first focusable
 * element, which is the title bar's close button. So this guards every dialog
 * in the suite, not just this one.
 */
test("typing a name keeps the caret in the field, letter after letter", () => {
  render(<NewFileDialog title="New show" directory="My files" onCreate={async () => {}} onClose={() => {}} />);
  const field = screen.getByLabelText("Name") as HTMLInputElement;
  field.focus();
  for (const letter of "Stage") {
    fireEvent.change(field, { target: { value: field.value + letter } });
    expect(document.activeElement, `focus left the field after typing "${letter}"`).toBe(field);
  }
  expect(field.value).toBe("Stage");
});

test("the field, not the close button, has focus when the dialog opens", () => {
  render(<NewFileDialog title="New show" directory="My files" onCreate={async () => {}} onClose={() => {}} />);
  expect(document.activeElement).toBe(screen.getByLabelText("Name"));
});

test("a parent re-render for an unrelated reason does not steal focus", () => {
  // The real page re-renders constantly while a dialog is open — a list
  // refresh, a poll, an autosave tick. None of them may touch the caret.
  function Page() {
    const [, bump] = useState(0);
    return (<>
      <button onClick={() => bump((n) => n + 1)}>unrelated</button>
      <NewFileDialog title="New show" directory="My files" onCreate={async () => {}} onClose={() => {}} />
    </>);
  }
  render(<Page />);
  const field = screen.getByLabelText("Name") as HTMLInputElement;
  field.focus();
  fireEvent.change(field, { target: { value: "Stage" } });
  expect(document.activeElement).toBe(field);
});

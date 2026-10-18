import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { NewDesignDialog, type DesignKind } from "./NewDesignDialog";

/**
 * The chooser an app shows when "create" could mean several things (Jonathan,
 * 2026-10-04, from Fusion's dialog, and asked for as an Aether UI standard).
 * The point of interest is the unavailable kinds: they stay on screen so the
 * menu describes the application, which means they must be impossible to
 * create by any route.
 */
const KINDS: readonly DesignKind[] = [
  { id: "part", title: "Part Design", summary: "One solid part", description: "Model a single part." },
  { id: "assembly", title: "Assembly Design", summary: "Parts mated" },
  { id: "drawing", title: "Drawing", summary: "Sheets", unavailable: "Drawings are not their own document yet." },
];

const dialog = (extra = {}) => {
  const onCreate = vi.fn(), onClose = vi.fn();
  render(<NewDesignDialog kinds={KINDS} onCreate={onCreate} onClose={onClose} {...extra} />);
  return { onCreate, onClose };
};

test("opens on the first available kind and explains it", () => {
  dialog();
  expect(screen.getByRole("radio", { name: "Part Design" }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByRole("heading", { name: "Part Design" })).toBeTruthy();
  expect(screen.getByText("Model a single part.")).toBeTruthy();
});

test("choosing a kind swaps the explanation, and creating reports that kind", () => {
  const { onCreate } = dialog();
  fireEvent.click(screen.getByRole("radio", { name: "Assembly Design" }));
  expect(screen.getByRole("heading", { name: "Assembly Design" })).toBeTruthy();
  // No description given, so the summary stands in rather than leaving a gap.
  expect(screen.getByText("Parts mated")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Create New" }));
  expect(onCreate).toHaveBeenCalledWith("assembly");
});

test("an unavailable kind is visible, selectable, and cannot be created", () => {
  const { onCreate } = dialog();
  const drawing = screen.getByRole("radio", { name: "Drawing" });
  expect(drawing).toBeTruthy();
  fireEvent.click(drawing);
  expect(screen.getByRole("note").textContent).toBe("Drawings are not their own document yet.");
  // Both routes out: the button, and the double-click shortcut.
  expect((screen.getByRole("button", { name: "Create New" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.doubleClick(drawing);
  expect(onCreate).not.toHaveBeenCalled();
});

test("settings are offered for a usable kind and withheld from an unusable one", () => {
  const onChange = vi.fn();
  dialog({ units: { label: "Unit System", value: "mm", onChange,
    options: [{ value: "mm", label: "millimeter (mm)" }, { value: "in", label: "inch (in)" }] } });
  fireEvent.change(screen.getByLabelText("Unit System"), { target: { value: "in" } });
  expect(onChange).toHaveBeenCalledWith("in");
  // Choosing something we cannot make hides the settings; they would imply it could.
  fireEvent.click(screen.getByRole("radio", { name: "Drawing" }));
  expect(screen.queryByLabelText("Unit System")).toBeNull();
});

test("double-clicking an available kind creates it", () => {
  const { onCreate } = dialog();
  fireEvent.doubleClick(screen.getByRole("radio", { name: "Assembly Design" }));
  expect(onCreate).toHaveBeenCalledWith("assembly");
});

test("the kinds are one radio group, so arrow keys move between them", () => {
  dialog();
  const group = screen.getByRole("radiogroup", { name: "What do you want to design?" });
  expect(within(group).getAllByRole("radio")).toHaveLength(3);
});

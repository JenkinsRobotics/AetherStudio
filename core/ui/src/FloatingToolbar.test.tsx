import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { FloatingToolbar } from "./FloatingToolbar";
import { FloatingToolbarDemo } from "../gallery/FloatingToolbarDemo";

test("command search filters tools, submits a match and clears with Escape", () => {
  render(<FloatingToolbarDemo />);
  const search = screen.getByRole("searchbox", { name: "Command" });
  fireEvent.change(search, { target: { value: "circ" } });
  expect(screen.queryByRole("button", { name: "Line" })).toBeNull();
  expect(screen.getByRole("button", { name: "Circle" })).toBeTruthy();
  fireEvent.submit(search.closest("form")!);
  expect(screen.getByRole("button", { name: "Circle" }).getAttribute("aria-pressed")).toBe("true");
  expect((search as HTMLInputElement).value).toBe("");
  expect(screen.getByText("Circle tool selected.")).toBeTruthy();
  fireEvent.change(search, { target: { value: "no-such-command" } });
  fireEvent.submit(search.closest("form")!);
  expect(screen.getByText("No command matches “no-such-command”.")).toBeTruthy();
  fireEvent.keyDown(search, { key: "Escape" });
  expect(screen.getByRole("button", { name: "Line" })).toBeTruthy();
});

test("shortcut commands and evaluation toggles have independent working state", () => {
  render(<FloatingToolbarDemo />);
  fireEvent.click(screen.getByRole("button", { name: "Boolean" }));
  expect(screen.getByText("Boolean tool selected.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Manual evaluation" }));
  expect(screen.getByRole("button", { name: "Manual evaluation" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "Automatic evaluation" }).getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByRole("button", { name: "Boolean" }).getAttribute("aria-pressed")).toBe("true");
});

test("document choices and selection modes update, and the menu resets toolbar state", () => {
  render(<FloatingToolbarDemo />);
  fireEvent.click(screen.getByRole("button", { name: "Face selection" }));
  fireEvent.click(screen.getByRole("button", { name: "Choose sample document" }));
  fireEvent.click(screen.getByRole("menuitemradio", { name: "Bracket.step" }));
  expect(screen.getByText("Face selection · Bracket.step")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Toolbar menu" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Reset toolbar" }));
  expect(screen.getByRole("button", { name: "Object selection" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText("Object selection · Bracket.step")).toBeTruthy();
});

test("arrow focus spans groups, skips disabled actions and leaves commands controlled", () => {
  const onAction = vi.fn();
  render(<FloatingToolbar ariaLabel="Tools" onAction={onAction} groups={[
    { id: "first", label: "First", actions: [{ id: "a", label: "A", pressed: true }, { id: "b", label: "B", disabled: true }] },
    { id: "last", label: "Last", actions: [{ id: "c", label: "C" }] },
  ]} />);
  const toolbar = within(screen.getByRole("toolbar", { name: "Tools" }));
  const first = toolbar.getByRole("button", { name: "A" }), last = toolbar.getByRole("button", { name: "C" });
  first.focus();
  fireEvent.keyDown(first, { key: "ArrowRight" });
  expect(document.activeElement).toBe(last);
  expect(onAction).not.toHaveBeenCalled();
  fireEvent.keyDown(last, { key: "ArrowRight" });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: "End" });
  expect(document.activeElement).toBe(last);
  fireEvent.click(last);
  expect(onAction).toHaveBeenCalledWith("c");
  expect(first.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(toolbar.getByRole("button", { name: "B" }));
  expect(onAction).toHaveBeenCalledTimes(1);
});

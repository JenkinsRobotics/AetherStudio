import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { SidebarSpecimen } from "../gallery/SidebarSpecimen";

test("slim specimen offers only top/bottom and retains edits through tabs, collapse and anchoring", () => {
  render(<SidebarSpecimen attachment="detached" variant="slim" />);
  const edge = screen.getByRole("combobox", { name: "Slim sidebar tab edge" });
  expect(within(edge).getAllByRole("option").map(option => option.textContent)).toEqual(["Top", "Bottom"]);
  const sidebar = screen.getByRole("complementary", { name: "Slim sidebar" });
  const tray = within(sidebar).getByRole("toolbar");
  const field = screen.getByLabelText("Location X") as HTMLInputElement;
  fireEvent.change(field, { target: { value: "42" } });
  fireEvent.blur(field);
  fireEvent.click(within(sidebar).getByRole("button", { name: "Lock Location X" }));
  fireEvent.click(within(tray).getByRole("button", { name: "Layers" }));
  expect(within(sidebar).getByText("Parts (2)")).toBeTruthy();
  fireEvent.click(within(tray).getByRole("button", { name: "Layers" }));
  expect(sidebar.getAttribute("data-open")).toBe("false");
  fireEvent.change(edge, { target: { value: "bottom" } });
  expect(sidebar.getAttribute("data-tabs")).toBe("bottom");
  expect(sidebar.getAttribute("data-anchor")).toBe("bottom");
  fireEvent.click(within(tray).getByRole("button", { name: "Properties" }));
  expect(screen.getByLabelText("Location X")).toBe(field);
  expect(field.value).toBe("42");
  expect(field.disabled).toBe(true);
  fireEvent.click(within(sidebar).getByRole("button", { name: "Unlock Location X" }));
  expect(field.disabled).toBe(false);
});

test("standard detached specimen retains its four tab-edge options", () => {
  render(<SidebarSpecimen attachment="detached" />);
  const edge = screen.getByRole("combobox", { name: "Detached sidebar tab edge" });
  expect(within(edge).getAllByRole("option").map(option => option.textContent)).toEqual(["Top", "Bottom", "Left", "Right"]);
});

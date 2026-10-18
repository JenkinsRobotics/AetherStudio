import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { TabbedSidebarDemo } from "../gallery/TabbedSidebarDemo";

afterEach(cleanup);
const tab = (name: string) => fireEvent.click(within(screen.getByRole("toolbar", { name: "Right sidebar tabs" })).getByRole("button", { name }));
const shape = () => screen.getByTestId("sidebar-preview-shape");

test("all sidebar tabs contain working widgets and share retained per-item edits", () => {
  render(<TabbedSidebarDemo />);
  expect(screen.getByRole("textbox", { name: "Location X" })).toBeTruthy();
  tab("Layers");
  const tree = within(screen.getByRole("tree", { name: "Reference Parts" }));
  fireEvent.click(tree.getByText("Part 2"));
  expect(shape().style.width).toBe("140px");
  tab("Appearance");
  fireEvent.click(screen.getByRole("button", { name: "Use color #ff3045" }));
  expect(shape().style.background).toBe("rgb(255, 48, 69)");
  tab("Inspector");
  expect((screen.getByRole("textbox", { name: "Fill color" }) as HTMLInputElement).value.toLowerCase()).toBe("#ff3045");
  fireEvent.input(screen.getByRole("textbox", { name: "Width" }), { target: { value: "180" } });
  fireEvent.blur(screen.getByRole("textbox", { name: "Width" }));
  expect(shape().style.width).toBe("180px");
  tab("Layers");
  fireEvent.click(tree.getByText("Part 1"));
  expect(shape().style.width).toBe("240px");
  fireEvent.click(tree.getByText("Part 2"));
  expect(shape().style.width).toBe("180px");
  expect(shape().style.background).toBe("rgb(255, 48, 69)");
  fireEvent.click(screen.getByRole("button", { name: "Options…" }));
  fireEvent.click(screen.getByRole("menuitemradio", { name: "Left" }));
  fireEvent.click(within(screen.getByRole("toolbar", { name: "Left sidebar tabs" })).getByRole("button", { name: "Inspector" }));
  expect((screen.getByRole("textbox", { name: "Width" }) as HTMLInputElement).value).toBe("180");
  fireEvent.click(screen.getByRole("button", { name: "Reset properties" }));
  expect(shape().style.width).toBe("140px");
  expect(shape().style.background).toBe("rgb(102, 89, 212)");
});

test("the sidebar contains the full reference Features tree and separate Parts list", () => {
  render(<TabbedSidebarDemo />);
  tab("Layers");
  const features = within(screen.getByRole("tree", { name: "Reference Items" }));
  for (const label of ["Assembly 1.step", "JAEP100005R1 - Part 1.step", "Body 03", "Body 02", "Sketch 02", "Body 01", "Sketch 01", "Folder 01", "Folder 03", "Folder 02"]) {
    expect(features.getByText(label)).toBeTruthy();
  }
  expect(features.getAllByRole("treeitem")).toHaveLength(10);
  expect(screen.getByText("Parts (2)")).toBeTruthy();
  expect(within(screen.getByRole("tree", { name: "Reference Parts" })).getAllByRole("treeitem")).toHaveLength(2);
  const divider = screen.getByRole("separator", { name: "Resize Items and Parts" });
  const before = Number(divider.getAttribute("aria-valuenow"));
  fireEvent.keyDown(divider, { key: "ArrowDown" });
  expect(Number(divider.getAttribute("aria-valuenow"))).toBeGreaterThan(before);
});

test("feature filtering and expansion leave Parts available, and folders offer useful guidance", () => {
  render(<TabbedSidebarDemo />);
  tab("Layers");
  fireEvent.click(screen.getByRole("button", { name: "Collapse Folder 01" }));
  expect(screen.queryByRole("treeitem", { name: "Folder 03" })).toBeNull();
  const search = screen.getByRole("searchbox", { name: "Find a feature" });
  fireEvent.change(search, { target: { value: "Sketch 02" } });
  expect(screen.getByRole("treeitem", { name: "Sketch 02" })).toBeTruthy();
  expect(screen.queryByRole("treeitem", { name: /Body 03/ })).toBeNull();
  expect(screen.getByRole("treeitem", { name: "Part 2" })).toBeTruthy();
  fireEvent.change(search, { target: { value: "missing" } });
  expect(screen.getByText("No features match your search.")).toBeTruthy();
  fireEvent.change(search, { target: { value: "" } });
  fireEvent.click(within(screen.getByRole("tree", { name: "Reference Items" })).getByText("Folder 01"));
  tab("Inspector");
  expect(screen.getByRole("region", { name: "Select an item" })).toBeTruthy();
  expect(screen.queryByRole("textbox", { name: "Width" })).toBeNull();
});

test("reference visibility and feature commands work inside the sidebar", () => {
  render(<TabbedSidebarDemo />);
  tab("Layers");
  expect(screen.getByRole("searchbox", { name: "Find a feature" }).getAttribute("placeholder")).toBe("All Items");
  fireEvent.contextMenu(screen.getByRole("treeitem", { name: "Part 1" }));
  expect(screen.getByRole("menu", { name: "Item options" })).toBeTruthy();
  expect(screen.queryByRole("menu", { name: "Sidebar options" })).toBeNull();
  fireEvent.click(screen.getByRole("menuitem", { name: "Hide" }));
  expect(screen.queryByTestId("sidebar-preview-shape")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Show Part 1" }));
  expect(shape().style.width).toBe("240px");
  fireEvent.click(screen.getByRole("button", { name: "Find a feature types" }));
  fireEvent.click(screen.getByRole("menuitemradio", { name: "Sketches" }));
  expect(screen.queryByRole("treeitem", { name: /Body 03/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "New folder" }));
  expect(screen.getByRole("treeitem", { name: "Folder 04" }).getAttribute("aria-selected")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "More Feature commands" }));
  fireEvent.click(screen.getByRole("menuitem", { name: /^Rename item/ }));
  const rename = screen.getByRole("textbox", { name: "Rename Folder 04" });
  fireEvent.change(rename, { target: { value: "Working features" } });
  fireEvent.keyDown(rename, { key: "Enter" });
  expect(screen.getByRole("treeitem", { name: "Working features" })).toBeTruthy();
  tab("Inspector");
  expect(screen.getByRole("region", { name: "Select an item" })).toBeTruthy();
  tab("Layers");
  fireEvent.click(screen.getByRole("button", { name: "More Feature commands" }));
  fireEvent.click(screen.getByRole("menuitem", { name: /^Delete item/ }));
  expect(screen.queryByRole("treeitem", { name: "Working features" })).toBeNull();
  expect(screen.getByRole("treeitem", { name: "Part 1" })).toBeTruthy();
});

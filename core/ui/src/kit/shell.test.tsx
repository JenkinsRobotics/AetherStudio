import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useState, type ReactNode } from "react";
import { KitShellProvider, ToolSidebar, defaultLayout, group, tool, type LayoutFlags, type ToolDensity } from "../Kit";

afterEach(cleanup);

const arm = { name: "Structure", icon: "cube", tint: "#4c9dff", tools: [] };
const categories = [
  { name: "Design", groups: [group("Create", [tool("cube", "Box"), tool("cylinder", "Cylinder"), tool("layers", "Thicken", false)])] },
  { name: "Sketch", groups: [group("Draw", [tool("pencil", "Line")])] },
];
const workspaces = [{ id: "design", name: "Design", icon: "copy" }, { id: "rig", name: "Rig", icon: "cube" }];

function Host({ density, children }: { density: ToolDensity; children: ReactNode }) {
  const [layout, setLayout] = useState<LayoutFlags>(defaultLayout);
  return <KitShellProvider layout={layout} setLayout={setLayout} initialRibbon={{ density }}>{children}</KitShellProvider>;
}

test("Standard density is the grouped layout: category tabs, labelled tools, group headings, no workspace box", () => {
  render(<Host density="standard"><ToolSidebar categories={categories} armGroup={arm} workspaces={workspaces} workspaceID="design" /></Host>);
  expect(screen.getByRole("tab", { name: "Design" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Box" })).toBeTruthy();
  expect(screen.getByText("Create")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^Workspace:/ })).toBeNull();
});

test("Expanded density adds the workspace dropdown and routes the choice", () => {
  const pick = vi.fn();
  render(<Host density="expanded"><ToolSidebar categories={categories} armGroup={arm} workspaces={workspaces} workspaceID="design" onWorkspaceSelect={pick} /></Host>);
  fireEvent.click(screen.getByRole("button", { name: "Workspace: Design" }));
  fireEvent.click(screen.getByText("Rig"));
  expect(pick).toHaveBeenCalledWith("rig");
});

test("group headings open the group's tool dropdown and groups are divided", () => {
  const { container } = render(<Host density="standard"><ToolSidebar categories={categories} armGroup={arm} /></Host>);
  expect(container.querySelectorAll(".aui-kit-category-tools .aui-kit-vdivider").length).toBe(0); // one group in Design
  expect(screen.queryByRole("button", { name: "Thicken" })).toBeNull(); // a "more" tool is not inline
  fireEvent.click(screen.getByRole("button", { name: "Create tools" }));
  const menu = screen.getByRole("menu");
  expect(menu.textContent).toContain("Box");
  expect(menu.textContent).toContain("Cylinder");
  expect(menu.textContent).toContain("MORE");
  expect(menu.textContent).toContain("Thicken");
  fireEvent.keyDown(menu, { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "More tools and toolbar settings" }));
  expect(screen.getByRole("menu").textContent).not.toContain("Thicken"); // the settings dots carry density only
});

test("Compact density keeps the catalogue's category tabs above the group icons, like the Aether ribbon", () => {
  render(<Host density="compact"><ToolSidebar categories={categories} armGroup={arm} /></Host>);
  expect(screen.getByRole("tab", { name: "Design" })).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Sketch" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Create" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Box" })).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "Sketch" }));
  expect(screen.getByRole("button", { name: "Draw" })).toBeTruthy();
});


test("product commands keep controlled selection, disabled commands and variants in each density", () => {
  const pick = vi.fn();
  const square = { id: "square", icon: "rectangle", label: "Square", primary: true, active: true };
  const rectangle = { id: "rect", icon: "rectangle", label: "Rectangle", primary: true };
  const smart = { id: "smart", icon: "eye", label: "Smart shapes", primary: true, disabled: true };
  const groups = [{ id: "shapes", name: "Shapes", tools: [{ ...rectangle, variants: [rectangle, square] }, smart] }];
  const { rerender } = render(<Host density="standard"><ToolSidebar groups={groups} armGroup={arm} onCommand={pick} /></Host>);
  fireEvent.click(screen.getByRole("button", { name: "Smart shapes" }));
  expect(pick).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Rectangle/Square variants" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Square" }));
  expect(pick).toHaveBeenLastCalledWith("square");
  rerender(<Host density="standard"><ToolSidebar groups={[{ ...groups[0], tools: [square, smart] }]} armGroup={arm} onCommand={pick} /></Host>);
  expect(screen.getByRole("button", { name: "Square" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "More tools and toolbar settings" }));
  fireEvent.click(screen.getByRole("menuitemradio", { name: /Compact/ }));
  fireEvent.click(screen.getByRole("button", { name: "Shapes" }));
  const disabled = screen.getByRole("menuitem", { name: "Smart shapes" }) as HTMLButtonElement;
  expect(disabled.disabled).toBe(true);
  fireEvent.click(screen.getByRole("menuitem", { name: "Square" }));
  expect(pick).toHaveBeenCalledTimes(2);
});


test("category tabs support keyboard navigation and controlled category changes", () => {
  const change = vi.fn();
  render(<Host density="standard"><ToolSidebar categories={categories} armGroup={arm} activeCategory="Design" onCategoryChange={change} /></Host>);
  fireEvent.keyDown(screen.getByRole("tab", { name: "Design" }), { key: "End" });
  expect(change).toHaveBeenCalledWith("Sketch");
  expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Sketch" }));
  expect(screen.getByRole("tabpanel", { name: "Design tools" })).toBeTruthy();
});


test("docked toolbars retain the chosen density rather than forcing expanded tools", () => {
  render(<Host density="standard"><ToolSidebar docked categories={categories} armGroup={arm} /></Host>);
  const toolbar = screen.getByRole("toolbar");
  expect(toolbar.hasAttribute("data-docked")).toBe(true);
  expect(toolbar.getAttribute("data-density")).toBe("standard");
  fireEvent.click(screen.getByRole("button", { name: "More tools and toolbar settings" }));
  fireEvent.click(screen.getByRole("menuitemradio", { name: /Compact/ }));
  expect(toolbar.getAttribute("data-density")).toBe("compact");
  expect(toolbar.hasAttribute("data-toolbar-menu-boundary")).toBe(true);
});


test("variant menus remember a choice independently of the active tool and support keyboard navigation", () => {
  const pick = vi.fn();
  const variants = [
    { ...tool("rectangle", "Rectangle"), id: "rect", selected: false },
    { ...tool("rectangle", "Unavailable"), id: "disabled", disabled: true, selected: false },
    { ...tool("rectangle", "Square"), id: "square", selected: true, active: false },
  ];
  render(<Host density="standard"><ToolSidebar groups={[{ id: "shape", name: "Shapes", tools: [{ ...variants[0], variants }] }]} armGroup={arm} onCommand={pick} /></Host>);
  const opener = screen.getByRole("button", { name: "Rectangle/Unavailable/Square variants" });
  opener.focus(); fireEvent.click(opener);
  const first = screen.getByRole("menuitemradio", { name: "Rectangle" });
  const square = screen.getByRole("menuitemradio", { name: "Square" });
  expect(document.activeElement).toBe(first);
  expect(square.getAttribute("aria-checked")).toBe("true");
  expect(square.querySelector('[data-icon="check"]')).toBeTruthy();
  fireEvent.keyDown(first, { key: "ArrowDown" });
  expect(document.activeElement).toBe(square);
  fireEvent.keyDown(square, { key: "ArrowDown" });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: "End" });
  expect(document.activeElement).toBe(square);
  fireEvent.keyDown(square, { key: "Home" });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: "Escape" });
  expect(screen.queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(opener);
  expect(pick).not.toHaveBeenCalled();
});

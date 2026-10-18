import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ComponentProps } from "react";
import type { WheelViewport } from "../gallery/wheel-studio/WheelViewport";
import { WheelReferenceDemo } from "../gallery/wheel-studio/WheelReferenceDemo";

let viewport: ComponentProps<typeof WheelViewport>;
vi.mock("../gallery/wheel-studio/WheelViewport", () => ({ WheelViewport: (props: ComponentProps<typeof WheelViewport>) => {
  viewport = props; return <div aria-label="Live wheel rendering boundary" />;
} }));
vi.mock("./ViewportNavigationCube", () => ({ ViewportNavigationCube: () => <div aria-label="View cube" /> }));
beforeEach(() => { localStorage.clear(); vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const button = (name: string) => screen.getByRole("button", { name });

test("one collapsible app navigation replaces outer bars and preserves the live study", () => {
  const { container } = render(<WheelReferenceDemo navigation />);
  const nav = screen.getByRole("complementary", { name: "Aether CAD sidebar" });
  expect(container.querySelector(".wr-header")).toBeNull();
  expect(container.querySelector(".wr-documents")).toBeNull();
  expect(container.querySelector("[data-icon-missing]")).toBeNull();
  expect(screen.queryByRole("navigation", { name: "Document views" })).toBeNull();
  expect(within(nav).getByRole("button", { name: "Expand Aether CAD sidebar" }).getAttribute("aria-expanded")).toBe("false");
  fireEvent.change(screen.getByRole("textbox", { name: "Reference part name" }), { target: { value: "Wheel 02" } });
  fireEvent.click(button("Expand Aether CAD sidebar"));
  fireEvent.click(button("Collapse Aether CAD sidebar"));
  expect(viewport.study.name).toBe("Wheel 02");
  expect(localStorage.getItem("aether-sidebar-wheel-navigation-concept")).toBe("collapsed");
  const center = screen.getByRole("region", { name: "Reference central workspace" });
  expect(within(center).getByRole("toolbar", { name: "Center bottom toolbar" })).toBeTruthy();
});

test("model views, units, modes and document commands update the shared wheel state", () => {
  render(<WheelReferenceDemo navigation />);
  fireEvent.change(screen.getByRole("combobox", { name: "Workspace units" }), { target: { value: "cm" } });
  expect((screen.getByRole("combobox", { name: "Reference units" }) as HTMLSelectElement).value).toBe("cm");
  fireEvent.click(screen.getByRole("radio", { name: "Variables" }));
  const width = screen.getByRole("textbox", { name: "Reference Width" });
  fireEvent.input(width, { target: { value: "16" } }); fireEvent.keyDown(width, { key: "Enter" });
  expect(viewport.study.width).toBe(160);
  fireEvent.click(screen.getByRole("radio", { name: "Parts" }));
  fireEvent.click(button("Hide reference wheel")); expect(viewport.study.visible).toBe(false);
  fireEvent.click(button("Show reference wheel")); expect(viewport.study.visible).toBe(true);
  fireEvent.click(button("Assembly")); expect(viewport.assembly).toBe(true);
  fireEvent.click(button("Simulation")); expect(viewport.turntable).toBe(true);
  fireEvent.click(button("Design")); expect(viewport.turntable).toBe(false); expect(viewport.assembly).toBe(false);
  fireEvent.click(button("Files")); fireEvent.click(button("Assembly 1")); expect(viewport.assembly).toBe(true);
  expect(viewport.study.width).toBe(160);
});

test("center command filtering and navigation actions remain accessible in the icon rail", () => {
  const onExit = vi.fn(); render(<WheelReferenceDemo navigation onExit={onExit} />);
  fireEvent.change(screen.getByRole("searchbox", { name: "Search modeling tools" }), { target: { value: "Fillet" } });
  expect(button("Fillet")).toBeTruthy(); expect(screen.queryByRole("button", { name: "Extrude" })).toBeNull();
  fireEvent.click(button("Center toggle grid")); expect(viewport.display.grid).toBe(false);
  fireEvent.click(button("Teams")); expect(screen.getByRole("dialog", { name: "Teams" })).toBeTruthy(); fireEvent.click(button("Done"));
  fireEvent.click(button("Navigation document menu")); fireEvent.click(screen.getByRole("menuitem", { name: "Demo apps" })); expect(onExit).toHaveBeenCalledOnce();
});

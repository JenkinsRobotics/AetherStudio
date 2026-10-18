import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { DashboardDemo } from "../gallery/dashboard-demo/DashboardDemo";
import { GoalProgress } from "./DashboardCards";
import { DashboardLineChart } from "./DashboardCharts";
import { aetherIconNames } from "./AetherIcon";
import { NAV } from "../gallery/dashboard-demo/data";
import { conceptApps } from "../gallery/ConceptAppDirectory";

beforeEach(() => { localStorage.clear(); vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("dashboard launches from the concept directory with shared icons and scoped theme", () => {
  expect(conceptApps.find(app => app.id === "commerce-dashboard")?.url).toBe("?demo=commerce-dashboard");
  for (const item of NAV.flatMap(group => group.items)) expect(aetherIconNames).toContain(item.icon);
  render(<DashboardDemo/>);
  expect(screen.getByRole("heading", { name: "Commerce Command Center" })).toBeTruthy();
  expect(screen.getAllByRole("progressbar")).toHaveLength(3);
  expect(document.documentElement.classList.contains("aether-theme-aether-commerce")).toBe(true);
  fireEvent.change(screen.getByRole("combobox", { name: "Store filter" }), { target: { value: "online" } });
  expect(screen.queryByText("Sophia Turner")).toBeNull();
  expect(screen.getByRole("article", { name: "Total Revenue: $107,873" })).toBeTruthy();
  fireEvent.change(screen.getByRole("combobox", { name: "Time period" }), { target: { value: "yesterday" } });
  expect(screen.getByRole("heading", { name: "Yesterday’s Statistics" })).toBeTruthy();
});

test("creating an order updates the queue and activity without leaving the demo", () => {
  render(<DashboardDemo/>);
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "New order" }));
  const dialog = screen.getByRole("dialog", { name: "Create demo order" });
  expect((within(dialog).getByRole("button", { name: "Create order" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Customer name" }), { target: { value: "Avery Stone" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Create order" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByText("Avery Stone")).toBeTruthy();
  expect(screen.getByText("New order #NX-28492 — $99.00")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Order Queue" }));
  fireEvent.click(screen.getByRole("button", { name: "Actions for NX-28492" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Mark fulfilled" }));
  const row = screen.getByText("Avery Stone").closest('[role="row"]')!;
  expect(within(row as HTMLElement).getByText("Fulfilled")).toBeTruthy();
});

test("search, goal editing, sidebar collapse and theme settings are functional", () => {
  render(<DashboardDemo/>);
  fireEvent.click(screen.getByRole("button", { name: "Edit monthly goals" }));
  const revenue = screen.getByRole("textbox", { name: "Revenue goal" });
  fireEvent.change(revenue, { target: { value: "300000" } }); fireEvent.blur(revenue);
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect((screen.getByRole("progressbar", { name: "Monthly Revenue" }) as HTMLProgressElement).value).toBeCloseTo(49.94, 1);
  fireEvent.change(screen.getByRole("searchbox", { name: "Search dashboard" }), { target: { value: "Sophia" } });
  expect(screen.getByText("Sophia Turner")).toBeTruthy(); expect(screen.queryByText("Ethan Brooks")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Collapse Dashboard navigation" }));
  expect(screen.getByRole("button", { name: "Expand Dashboard navigation" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Dashboard appearance" }), { target: { value: "dark" } });
  expect(document.documentElement.dataset.aetherTheme).toBe("dark");
});

test("shared chart supports keyboard selection and progress clamps invalid bounds", () => {
  const select = vi.fn();
  render(<><DashboardLineChart label="Revenue" data={[{ id: "a", label: "Monday", value: 10 }, { id: "b", label: "Tuesday", value: 20 }]} onSelect={select}/><GoalProgress label="Over goal" value={200} target={100}/><GoalProgress label="No goal" value={10} target={0}/></>);
  fireEvent.keyDown(screen.getByRole("button", { name: "Tuesday: 20" }), { key: "Enter" });
  expect(select).toHaveBeenCalledWith("b");
  expect((screen.getByRole("progressbar", { name: "Over goal" }) as HTMLProgressElement).value).toBe(100);
  expect((screen.getByRole("progressbar", { name: "No goal" }) as HTMLProgressElement).value).toBe(0);
});

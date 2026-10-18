import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AppNavigationBar } from "./AppNavigationBar";
import { AnalyticsDemo } from "../gallery/analytics-demo/AnalyticsDemo";
import { AppNavigationBarSpecimen } from "../gallery/analytics-demo/AnalyticsSpecimens";
import { sectionTab } from "../gallery/showcase";

afterEach(cleanup);

test("top navigation exposes the current page, disabled pages and independent home/actions", () => {
  const navigate = vi.fn(), home = vi.fn(), action = vi.fn();
  render(<AppNavigationBar brand="Example" items={[{ id: "home", label: "Overview" }, { id: "reports", label: "Reports" }, { id: "locked", label: "Locked", disabled: true }]} activeID="home" onNavigate={navigate} onHome={home} actions={<button onClick={action}>Profile</button>}/>);
  const nav = within(screen.getByRole("navigation", { name: "Example" }));
  expect(nav.getByRole("button", { name: "Overview" }).getAttribute("aria-current")).toBe("page");
  fireEvent.click(nav.getByRole("button", { name: "Reports" }));
  fireEvent.click(nav.getByRole("button", { name: "Locked" }));
  expect(navigate.mock.calls).toEqual([["reports"]]);
  fireEvent.click(screen.getByRole("button", { name: "Example home" }));
  fireEvent.click(screen.getByRole("button", { name: "Profile" }));
  expect(home).toHaveBeenCalledOnce();
  expect(action).toHaveBeenCalledOnce();
});

test("Analytics top and side layouts share page and reporting state", () => {
  render(<AnalyticsDemo/>);
  fireEvent.change(screen.getByRole("combobox", { name: "Reporting period" }), { target: { value: "previous" } });
  fireEvent.click(screen.getByRole("button", { name: "Reports" }));
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Reports");
  fireEvent.click(screen.getByRole("button", { name: "Aether Analytics home" }));
  expect(screen.getByRole("meter", { name: "Conversion rate: 12.6%" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Navigation layout" }), { target: { value: "side" } });
  expect(screen.queryByRole("button", { name: "Aether Analytics home" })).toBeNull();
  expect(screen.getByRole("button", { name: "Expand Aether Analytics navigation" })).toBeTruthy();
  fireEvent.change(screen.getByRole("combobox", { name: "Navigation layout" }), { target: { value: "top" } });
  fireEvent.click(screen.getByRole("button", { name: "Aether Analytics home" }));
  expect(screen.getByRole("meter", { name: "Conversion rate: 12.6%" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Profile" }));
  expect(screen.getByRole("dialog", { name: "Your profile" }).textContent).toContain("Alex Morgan");
});

test("the independent header specimen belongs to Overlays", () => {
  render(<AppNavigationBarSpecimen/>);
  fireEvent.click(screen.getByRole("button", { name: "Customers" }));
  expect(screen.getByRole("status").textContent).toBe("Customers selected");
  fireEvent.click(screen.getByRole("button", { name: "Aether Analytics home" }));
  expect(screen.getByRole("status").textContent).toBe("Dashboard selected");
  fireEvent.click(screen.getByRole("button", { name: "Share" }));
  expect(screen.getByRole("dialog", { name: "Share" }).textContent).toContain("connected to a document");
  expect(sectionTab("Top app navigation")).toBe("windows");
});


test("registered top navigation uses its wordmark and retains the home action", () => {
  const home = vi.fn();
  render(<AppNavigationBar brand="Aether CAD" items={[]} activeID="" onNavigate={() => {}} onHome={home}/>);
  const brand = screen.getByRole("button", { name: "Aether CAD home" });
  expect(brand.querySelector(".aui-app-wordmark")?.getAttribute("data-app")).toBe("cad");
  fireEvent.click(brand);
  expect(home).toHaveBeenCalledOnce();
});

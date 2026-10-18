import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ComparisonChart, GaugeChart, RankedList, aetherThemes } from "./index";
import { AnalyticsDemo } from "../gallery/analytics-demo/AnalyticsDemo";
import { AnalyticsSpecimens, DashboardNavigationSpecimen } from "../gallery/analytics-demo/AnalyticsSpecimens";
import { USERS } from "../gallery/analytics-demo/data";
import { parseUsersCSV, usersCSV } from "../gallery/analytics-demo/csv";
import { conceptApps } from "../gallery/ConceptAppDirectory";
import { sectionTab } from "../gallery/showcase";

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

test("comparison charts inspect with keyboard and toggle series without invalid SVG", () => {
  const selected = vi.fn();
  const { container } = render(<ComparisonChart label="Traffic" data={[{ id: "a", label: "Monday", values: { first: 100, second: Number.NaN } }, { id: "b", label: "Tuesday", values: { first: 200, second: -10 } }]} series={[{ id: "first", label: "Trial", color: "blue" }, { id: "second", label: "Demo", color: "orange" }]} onSelect={selected}/>);
  fireEvent.keyDown(screen.getByRole("button", { name: "Monday: Trial 100, Demo 0" }), { key: "Enter" });
  expect(selected).toHaveBeenCalledWith("a");
  fireEvent.click(screen.getByRole("button", { name: "Trial" }));
  expect(screen.getByRole("button", { name: "Trial" }).getAttribute("aria-pressed")).toBe("false");
  expect(container.querySelectorAll("polyline")).toHaveLength(1);
  expect(container.querySelector("svg")!.outerHTML).not.toMatch(/NaN|Infinity/);
  fireEvent.click(screen.getByRole("button", { name: "Demo" }));
  expect(screen.getByText("Select a series to display.")).toBeTruthy();
});

test("gauge proportions stay bounded and ranked rows identify selected metrics", () => {
  const choose = vi.fn();
  const { rerender } = render(<GaugeChart label="Conversion" value="25%" fraction={1.2}/>);
  expect(screen.getByRole("meter").getAttribute("aria-valuenow")).toBe("100");
  rerender(<GaugeChart label="Conversion" value="—" fraction={Number.NaN}/>);
  expect(screen.getByRole("meter").getAttribute("aria-valuenow")).toBe("0");
  rerender(<RankedList label="Sources" items={[{ id: "sg", label: "Singapore", value: "4.7M" }]} onSelect={choose} selectedID="sg"/>);
  fireEvent.click(screen.getByRole("button"));
  expect(choose).toHaveBeenCalledWith("sg");
  expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("true");
});

test("app period, customer search, filtering and navigation update the mockup", () => {
  const { container } = render(<AnalyticsDemo/>);
  expect(screen.getByRole("meter", { name: "Conversion rate: 15.4%" })).toBeTruthy();
  fireEvent.change(screen.getByRole("combobox", { name: "Reporting period" }), { target: { value: "previous" } });
  expect(screen.getByRole("meter", { name: "Conversion rate: 12.6%" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Search customers" }));
  fireEvent.change(screen.getByRole("searchbox", { name: "Search users" }), { target: { value: "sarah" } });
  expect(screen.getByText("1 users · Jul 21 – Jul 31")).toBeTruthy();
  expect(screen.getByText("Sarah Molatio")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  fireEvent.change(screen.getByRole("combobox", { name: "User status" }), { target: { value: "Inactive" } });
  expect(screen.getByText("No users match these filters.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(screen.getByText("8 users · Jul 21 – Jul 31")).toBeTruthy();
  expect(container.querySelectorAll("[data-icon-missing]")).toHaveLength(0);
});

test("country drill-down filters users and menus open actual data", () => {
  render(<AnalyticsDemo/>);
  fireEvent.click(within(screen.getByRole("list", { name: "Top countries" })).getByRole("button", { name: /Singapore/ }));
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Customers");
  expect(screen.getByRole("status").textContent).toContain("Singapore");
  fireEvent.click(within(screen.getByRole("navigation", { name: "Aether Analytics" })).getByRole("button", { name: "Dashboard" }));
  fireEvent.click(screen.getByRole("button", { name: "Trials actions" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "View data" }));
  const dialog = screen.getByRole("dialog", { name: "Trials" });
  expect(dialog.textContent).toContain("Day,Trial,Demo");
  fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("CSV import accepts quoted fields and rejects bad or duplicate rows atomically", () => {
  const original = [{ ...USERS[0], name: 'Morgan, "Alex"' }, USERS[1]];
  const restored = parseUsersCSV(usersCSV(original), "next");
  expect(restored[0].name).toBe(original[0].name);
  expect(restored[0].period).toBe("next");
  expect(parseUsersCSV(usersCSV(USERS.slice(0, 8)), "current")).toHaveLength(8);
  expect(() => parseUsersCSV("name,email\nAlex,invalid", "current")).toThrow("Required columns");
  expect(() => parseUsersCSV(usersCSV([USERS[0], USERS[0]]), "current")).toThrow("duplicate email");
  expect(() => parseUsersCSV(usersCSV([{ ...USERS[0], email: "invalid" }]), "current")).toThrow("Row 2");
  expect(usersCSV([{ ...USERS[0], username: "=SUM(1,2)" }])).toContain("'=SUM(1,2)");
});

test("local CSV upload replaces only the selected period and errors preserve rows", async () => {
  render(<AnalyticsDemo/>);
  const good = new File([""], "users.csv", { type: "text/csv" });
  Object.defineProperty(good, "text", { value: async () => usersCSV(USERS.slice(0, 2)) });
  fireEvent.change(screen.getByLabelText("Import users CSV"), { target: { files: [good] } });
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Imported 2 sample users"));
  expect(screen.getByText("2 users · Aug 1 – Aug 11")).toBeTruthy();
  const bad = new File([""], "bad.csv", { type: "text/csv" });
  Object.defineProperty(bad, "text", { value: async () => "wrong,columns" });
  fireEvent.change(screen.getByLabelText("Import users CSV"), { target: { files: [bad] } });
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Required columns"));
  expect(screen.getByText("2 users · Aug 1 – Aug 11")).toBeTruthy();
  fireEvent.change(screen.getByRole("combobox", { name: "Reporting period" }), { target: { value: "previous" } });
  expect(screen.getByText("8 users · Jul 21 – Jul 31")).toBeTruthy();
});

test("standalone components are catalogued and the rail collapses independently", () => {
  render(<><AnalyticsSpecimens/><DashboardNavigationSpecimen/></>);
  expect(screen.getByRole("group", { name: "Sample trials" })).toBeTruthy();
  expect(screen.getByRole("meter")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Expand Aether Analytics navigation" }));
  expect(screen.getByRole("button", { name: "Collapse Aether Analytics navigation" }).getAttribute("aria-expanded")).toBe("true");
  expect(sectionTab("Analytics charts + rankings")).toBe("widgets");
  expect(sectionTab("Chart legends")).toBe("elements");
  expect(sectionTab("Status badges")).toBe("elements");
  expect(sectionTab("Dashboard navigation")).toBe("windows");
  expect(conceptApps.find(app => app.id === "analytics-dashboard")?.url).toBe("?demo=analytics-dashboard");
  expect(aetherThemes.find(theme => theme.id === "aether-analytics")?.modes.dark["color-bg-panel"]).toBe("#1e2023");
});

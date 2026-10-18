import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ShowcaseBrowser } from "../gallery/showcase/ShowcaseBrowser";
import { useShowcaseView } from "../gallery/showcase/ShowcaseView";
import { ShowcaseSections } from "../gallery/showcase/ShowcaseLayout";
import { COLLECTIONS_STORAGE_KEY, parseCollections } from "../gallery/showcase/collections";
import { SHOWCASE_TABS } from "../gallery/showcase";

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, "", "#tab=widgets&section=showcase-flow-diagrams&collection=flow-signals");
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function Sample({ title }: { title: string }) { return <section data-sample={title}>{title} specimen</section>; }
function Content() {
  const view = useShowcaseView();
  return <ShowcaseSections tab={view.tab} selected={view.section} individual={Boolean(view.collectionId)}>{SHOWCASE_TABS.flatMap(tab => tab.sections).map(title => <Sample key={title} title={title} />)}</ShowcaseSections>;
}
const button = (name: string) => screen.getByRole("button", { name });

test("saved collections navigate across tabs, survive remount, edit, remove and undo without deleting specimens", () => {
  const first = render(<ShowcaseBrowser><Content /></ShowcaseBrowser>);
  fireEvent.click(button("Save as collection"));
  fireEvent.change(screen.getByRole("textbox", { name: "Collection name" }), { target: { value: "References" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Buttons" }));
  fireEvent.click(button("Save collection"));
  const saved = parseCollections(localStorage.getItem(COLLECTIONS_STORAGE_KEY)!);
  expect(saved[0].sections).toEqual(["Buttons", "Flow diagrams"]);
  const navigation = within(screen.getByRole("navigation", { name: "Collections" }));
  fireEvent.click(navigation.getByRole("button", { name: "Buttons" }));
  expect(first.container.querySelectorAll("[data-sample]")).toHaveLength(1);
  expect(screen.getByText("Buttons specimen")).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Elements" }).getAttribute("aria-selected")).toBe("true");
  first.unmount();
  render(<ShowcaseBrowser><Content /></ShowcaseBrowser>);
  expect(screen.getByText("Buttons specimen")).toBeTruthy();
  fireEvent.click(button("Edit collection"));
  fireEvent.click(screen.getByRole("checkbox", { name: "Buttons" }));
  fireEvent.click(button("Save collection"));
  expect(screen.getByText("Flow diagrams specimen")).toBeTruthy();
  fireEvent.click(button("Remove collection"));
  expect(parseCollections(localStorage.getItem(COLLECTIONS_STORAGE_KEY)!)).toHaveLength(0);
  expect(screen.getByText("Flow diagrams specimen")).toBeTruthy();
  fireEvent.click(button("Undo collection removal"));
  expect(parseCollections(localStorage.getItem(COLLECTIONS_STORAGE_KEY)!)[0].sections).toEqual(["Flow diagrams"]);
});

test("history restores the selected collection and scoped theme without writing global preferences", () => {
  const rootTheme = document.documentElement.getAttribute("data-aether-theme");
  const { container } = render(<ShowcaseBrowser><Content /></ShowcaseBrowser>);
  fireEvent.click(button("Theme collections"));
  fireEvent.click(button("Aether Orange 7"));
  fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
  expect(container.querySelector(".showcase-theme-preview.aether-dark-theme")).toBeTruthy();
  expect(document.documentElement.getAttribute("data-aether-theme")).toBe(rootTheme);
  const themed = location.hash;
  fireEvent.click(screen.getByRole("tab", { name: "Elements" }));
  expect(container.querySelector(".showcase-theme-preview")).toBeNull();
  act(() => { history.replaceState(null, "", themed); window.dispatchEvent(new PopStateEvent("popstate")); });
  expect(container.querySelector(".showcase-theme-preview.aether-dark-theme")).toBeTruthy();
  expect(button("Theme collections").getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText("Flow diagrams specimen")).toBeTruthy();
});

test("storage failure reports session-only organization while keeping the new collection usable", () => {
  render(<ShowcaseBrowser><Content /></ShowcaseBrowser>);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("unavailable"); });
  fireEvent.click(button("Save as collection"));
  fireEvent.change(screen.getByRole("textbox", { name: "Collection name" }), { target: { value: "Session references" } });
  fireEvent.click(button("Save collection"));
  expect(screen.getByText("Browser storage is unavailable. Collection changes will last for this session.")).toBeTruthy();
  expect(screen.getByText("Flow diagrams specimen")).toBeTruthy();
  expect(button("Session references 1")).toBeTruthy();
});

test("the standard sidebar lists the workspace's categories, navigates and filters", () => {
  history.replaceState(null, "", "#tab=elements&section=showcase-buttons");
  render(<ShowcaseBrowser><Content /></ShowcaseBrowser>);
  const nav = within(screen.getByRole("complementary", { name: "Aether UI sidebar" }));
  expect(nav.getByRole("navigation", { name: "Selection" })).toBeTruthy();
  fireEvent.click(nav.getByRole("button", { name: "Sliders" }));
  expect(screen.getByText("Sliders specimen")).toBeTruthy();
  expect(nav.getByRole("button", { name: "Sliders" }).getAttribute("aria-current")).toBe("page");
  fireEvent.change(nav.getByRole("searchbox"), { target: { value: "breadcr" } });
  expect(nav.getByRole("button", { name: "Breadcrumbs" })).toBeTruthy();
  expect(nav.queryByRole("button", { name: "Sliders" })).toBeNull();
});

test("related overlay families share comparison pages in one tab", () => {
  history.replaceState(null, "", "#tab=chrome&section=showcase-side-tool-bars");
  render(<ShowcaseBrowser><Content /></ShowcaseBrowser>);
  expect(screen.queryByRole("tab", { name: "Workspace Chrome" })).toBeNull();
  expect(screen.getByRole("tab", { name: "Overlays" }).getAttribute("aria-selected")).toBe("true");
  expect(location.hash).toContain("tab=windows");
  const nav = within(screen.getByRole("complementary", { name: "Aether UI sidebar" }));
  for (const name of ["Navigation bars", "Sidebars", "Toolbars"]) expect(nav.getByRole("navigation", { name })).toBeTruthy();
  fireEvent.click(nav.getByRole("button", { name: "Toolbars" }));
  expect(screen.getByText("Floating toolbars specimen")).toBeTruthy();
  expect(screen.getByText("Top tool bars specimen")).toBeTruthy();
  expect(screen.getByText("Center tray tool bar specimen")).toBeTruthy();
  expect(screen.getByText("Tool rails specimen")).toBeTruthy();
  expect(location.hash).toContain("section=showcase-floating-toolbars");
  fireEvent.click(nav.getByRole("button", { name: "Navigation bars" }));
  expect(screen.getByRole("tab", { name: "Overlays" }).getAttribute("aria-selected")).toBe("true");
});

test.each(["showcase-floating-toolbars", "showcase-top-tool-bars", "showcase-center-tray-tool-bar", "showcase-tool-rails"])("toolbar link %s keeps the entire comparison mounted", section => {
  history.replaceState(null, "", `#tab=windows&section=${section}`);
  const { container } = render(<ShowcaseBrowser><Content /></ShowcaseBrowser>);
  const toolbars = SHOWCASE_TABS.find(tab => tab.id === "windows")!.groups.find(group => group.id === "toolbars")!.sections;
  expect(screen.getByRole("heading", { name: "Toolbars" })).toBeTruthy();
  expect([...container.querySelectorAll("[data-sample]")].map(node => node.getAttribute("data-sample"))).toEqual(toolbars);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Toolbars designs" })).getByRole("button", { name: "Ribbons" }));
  expect(container.querySelectorAll("[data-sample]")).toHaveLength(toolbars.length);
  fireEvent.click(button("Next section"));
  expect(screen.getByRole("heading", { name: "Status bar" })).toBeTruthy();
});

test("header deep links show every design together, page navigation skips siblings and saving includes the family", () => {
  history.replaceState(null, "", "#tab=windows&section=showcase-concept-app-header");
  const { container } = render(<ShowcaseBrowser><Content /></ShowcaseBrowser>);
  const headers = SHOWCASE_TABS.find(tab => tab.id === "windows")!.groups.find(group => group.id === "headers")!.sections;
  expect(screen.getByRole("heading", { name: "Header bars" })).toBeTruthy();
  expect([...container.querySelectorAll("[data-sample]")].map(node => node.getAttribute("data-sample"))).toEqual(headers);
  fireEvent.click(button("Save as collection"));
  fireEvent.change(screen.getByRole("textbox", { name: "Collection name" }), { target: { value: "Header review" } });
  fireEvent.click(button("Save collection"));
  expect(parseCollections(localStorage.getItem(COLLECTIONS_STORAGE_KEY)!)[0].sections).toEqual(expect.arrayContaining([...headers]));
  expect(container.querySelectorAll("[data-sample]")).toHaveLength(1);
  const sidebar = within(screen.getByRole("complementary", { name: "Aether UI sidebar" }));
  fireEvent.click(sidebar.getByRole("button", { name: "Header bars" }));
  expect(container.querySelectorAll("[data-sample]")).toHaveLength(headers.length);
  fireEvent.click(button("Next section"));
  expect(screen.getByRole("heading", { name: "Navigation bars" })).toBeTruthy();
  fireEvent.click(button("Previous section"));
  expect(screen.getByRole("heading", { name: "Header bars" })).toBeTruthy();
  fireEvent.change(sidebar.getByRole("searchbox"), { target: { value: "concept app" } });
  expect(sidebar.getByRole("button", { name: "Header bars" })).toBeTruthy();
  expect(sidebar.queryByRole("button", { name: "Toolbars" })).toBeNull();
});

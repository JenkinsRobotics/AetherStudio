import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { SidebarSpecimen } from "../gallery/SidebarSpecimen";
import { LEGACY_WORKSPACE_SECTIONS, WORKSPACE_SECTION, WORKSPACE_DEMOS, WORKSPACE_ASSETS, workspaceAssetURL, WorkspaceDemoDirectory, WorkspaceDemoWindow } from "../gallery/WorkspaceDemos";
import { parseCollections, readShowcaseLocation, SHOWCASE_COLLECTIONS } from "../gallery/showcase/collections";
import { StandardWindowLayouts, ThreeColumnWireframe } from "../gallery/StandardWindowLayouts";
import { sectionID, sectionTab } from "../gallery/showcase";
import { BottomPanelSpecimen, SplitPaneSpecimen } from "../gallery/PanelSpecimens";

afterEach(() => vi.restoreAllMocks());

test("independent sidebars retain edited values and part selection across tabs and collapse", () => {
  const { container } = render(<><SidebarSpecimen attachment="attached" /><SidebarSpecimen attachment="detached" /></>);
  expect(container.querySelector(".aui-shell")).toBeNull();
  const attached = within(screen.getByRole("complementary", { name: "Attached sidebar" }));
  fireEvent.change(attached.getByRole("textbox", { name: "Location X" }), { target: { value: "12" } });
  fireEvent.blur(attached.getByRole("textbox", { name: "Location X" }));
  fireEvent.click(attached.getByRole("button", { name: "Layers" }));
  fireEvent.click(attached.getByRole("treeitem", { name: "Part 2" }));
  fireEvent.click(attached.getByRole("button", { name: "Inspector" }));
  expect(attached.getAllByText("Part 2").some(element => !element.closest("[hidden]"))).toBe(true);
  fireEvent.click(attached.getByRole("button", { name: "Inspector" }));
  expect(attached.queryByRole("textbox")).toBeNull();
  fireEvent.click(attached.getByRole("button", { name: "Properties" }));
  expect((attached.getByRole("textbox", { name: "Location X" }) as HTMLInputElement).value).toBe("12");
  const detached = within(screen.getByRole("complementary", { name: "Detached sidebar" }));
  expect((detached.getByRole("textbox", { name: "Location X" }) as HTMLInputElement).value).toBe("0");
});

test("workspace cards use one window action and reuse the open app without losing its state", () => {
  window.history.replaceState({}, "", "/ui/#tab=apps");
  const focus = vi.fn(), popup = { focus, opener: window, closed: false };
  const open = vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
  const { container } = render(<WorkspaceDemoDirectory />);
  expect(container.querySelector(".aui-shell")).toBeNull();
  expect(screen.getAllByRole("button")).toHaveLength(WORKSPACE_DEMOS.length);
  expect(screen.queryByRole("link")).toBeNull();
  const card = screen.getByRole("button", { name: /^Sidebar workspace/ });
  fireEvent.click(card);
  expect(open).toHaveBeenCalledWith(expect.stringContaining("/ui/?demo=workspace&workspace=sidebars&presentation=window"), "aether-ui-demo-workspace-sidebars", expect.stringContaining("popup=yes"));
  expect(open.mock.calls[0][2]).toContain("resizable=yes");
  expect(popup.opener).toBeNull();
  fireEvent.click(card);
  expect(open).toHaveBeenCalledOnce();
  expect(focus).toHaveBeenCalledTimes(2);
});

test("a blocked window offers one retry dialog without adding fallback hyperlinks", () => {
  const open = vi.spyOn(window, "open").mockReturnValueOnce(null).mockReturnValue({ focus: vi.fn(), opener: window } as unknown as Window);
  render(<WorkspaceDemoDirectory />);
  fireEvent.click(screen.getByRole("button", { name: /^Bottom dock workspace/ }));
  expect(screen.getByRole("dialog", { name: "Bottom dock workspace" }).textContent).toContain("blocked");
  expect(screen.queryByRole("link")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(open).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("old workspace bookmarks and saved collections migrate to the window directory", () => {
  for (const title of LEGACY_WORKSPACE_SECTIONS) {
    const location = readShowcaseLocation(`#tab=chrome&section=${sectionID(title)}`, SHOWCASE_COLLECTIONS);
    expect(location.section).toBe(WORKSPACE_SECTION);
    expect(location.tab).toBe("apps");
  }
  const collections = parseCollections(JSON.stringify({ version: 1, collections: [{ id: "custom-workspaces", label: "My workspace examples", description: "", kind: "collection", sections: LEGACY_WORKSPACE_SECTIONS }] }));
  expect(collections[0].sections).toEqual([WORKSPACE_SECTION]);
});

test("workspace asset metadata still resolves to independent specimens without adding directory links", () => {
  window.history.replaceState({}, "", "/ui/?demo=workspace&workspace=layout");
  render(<WorkspaceDemoDirectory />);
  expect(screen.queryByRole("navigation")).toBeNull();
  expect(screen.queryByRole("link")).toBeNull();
  for (const id of Object.keys(WORKSPACE_ASSETS) as (keyof typeof WORKSPACE_ASSETS)[]) {
    const url = new URL(workspaceAssetURL(id));
    expect(url.pathname).toBe("/ui/");
    expect(url.search).toBe("");
    const location = readShowcaseLocation(url.hash, SHOWCASE_COLLECTIONS);
    expect(location.section).toBeTruthy();
    expect(["elements", "widgets", "windows"]).toContain(location.tab);
  }
});

test("standalone split and bottom panels resize, collapse and retain working tab state without a workspace", () => {
  const { container } = render(<><SplitPaneSpecimen /><BottomPanelSpecimen /></>);
  expect(container.querySelector(".aui-shell")).toBeNull();
  const divider = screen.getByRole("separator", { name: "Resize primary panel" });
  fireEvent.keyDown(divider, { key: "ArrowRight" });
  expect(divider.getAttribute("aria-valuenow")).toBe("250");
  fireEvent.keyDown(divider, { key: "Home" });
  expect(container.querySelector(".aui-split-pane-primary")?.hasAttribute("hidden")).toBe(true);
  fireEvent.doubleClick(divider);
  expect(container.querySelector(".aui-split-pane-primary")?.hasAttribute("hidden")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  expect(screen.getByText("No problems")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: /^Console/ }));
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  fireEvent.click(screen.getByRole("button", { name: "Collapse bottom panel" }));
  expect(screen.queryByRole("tabpanel")).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "Console" }));
  expect(screen.getByText("Console cleared")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "Problems 0" }));
  expect(screen.getByText("No problems")).toBeTruthy();
});


test("standard layouts show components without scattered demo launchers", () => {
  window.history.replaceState({}, "", "/ui/#tab=windows&section=showcase-window-layouts");
  const { container } = render(<StandardWindowLayouts />);
  expect(sectionTab("Window layouts")).toBe("windows");
  expect(screen.getByRole("region", { name: "Two-column layout preview" })).toBeTruthy();
  expect(screen.getByRole("region", { name: "Three-column layout preview" })).toBeTruthy();
  expect(container.querySelectorAll(".aui-workbench-window")).toHaveLength(1);
  expect(container.querySelectorAll(".aui-shell")).toHaveLength(2);
  expect(screen.queryByRole("link")).toBeNull();
  expect(container.querySelector(".aui-shell-main > .aui-shell-toolbar")).toBeTruthy();
  expect(container.querySelector(".aui-shell-center .aui-workspace-bottom-dock")).toBeTruthy();
});

test("app wireframe keeps optional outer bars outside its full-height three-column body", () => {
  const { container } = render(<ThreeColumnWireframe />);
  const shell = container.querySelector(".aui-shell")!;
  expect(shell.querySelectorAll(".aui-shell-area > .aui-shell-side")).toHaveLength(2);
  expect(shell.querySelector(".aui-shell-main > .aui-shell-toolbar")).toBeTruthy();
  expect(shell.querySelector(".aui-shell-area .app-wireframe-footer")).toBeNull();
  expect(container.querySelector(".aui-app-layout > footer .app-wireframe-footer")).toBeTruthy();
  fireEvent.click(screen.getByRole("checkbox", { name: "Header" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Footer" }));
  expect(container.querySelector(".app-wireframe-header")).toBeNull();
  expect(container.querySelector(".app-wireframe-footer")).toBeNull();
  expect(shell.querySelectorAll(".aui-shell-area > .aui-shell-side")).toHaveLength(2);
  fireEvent.click(screen.getByRole("checkbox", { name: "Header" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Footer" }));
  expect(container.querySelector(".app-wireframe-header")).toBeTruthy();
  expect(container.querySelector(".app-wireframe-footer")).toBeTruthy();
});

test("general layout navigation, resizing and collapse retain edited workspace content", () => {
  render(<StandardWindowLayouts />);
  const general = within(screen.getByRole("region", { name: "Two-column layout preview" }));
  fireEvent.change(general.getByRole("textbox", { name: "Workspace name" }), { target: { value: "My review" } });
  fireEvent.click(general.getByRole("button", { name: "Projects" }));
  expect(general.getByRole("button", { name: "Projects" }).getAttribute("aria-current")).toBe("page");
  const divider = general.getByRole("separator", { name: "Resize workspace sidebar" });
  fireEvent.keyDown(divider, { key: "ArrowRight" });
  expect(Number(divider.getAttribute("aria-valuenow"))).toBeGreaterThan(232);
  fireEvent.click(general.getByRole("button", { name: "Hide sidebar" }));
  expect(general.queryByRole("navigation")).toBeNull();
  fireEvent.click(general.getByRole("button", { name: "Show sidebar" }));
  expect((general.getByRole("textbox", { name: "Workspace name" }) as HTMLInputElement).value).toBe("My review");
  expect(general.getByRole("button", { name: "Projects" }).getAttribute("aria-current")).toBe("page");
});

test("application columns share selection and preserve inspector edits through collapse", () => {
  render(<StandardWindowLayouts />);
  const application = within(screen.getByRole("region", { name: "Three-column layout preview" }));
  fireEvent.click(application.getByRole("button", { name: "Part 2" }));
  const field = application.getByRole("textbox", { name: "Selected item name" });
  expect((field as HTMLInputElement).value).toBe("Part 2");
  fireEvent.change(field, { target: { value: "Bracket" } });
  fireEvent.click(application.getByRole("button", { name: "Inspector" }));
  expect(application.queryByRole("textbox", { name: "Selected item name" })).toBeNull();
  fireEvent.click(application.getByRole("button", { name: "Inspector" }));
  expect((application.getByRole("textbox", { name: "Selected item name" }) as HTMLInputElement).value).toBe("Bracket");
  fireEvent.click(application.getByRole("button", { name: "Move" }));
  expect(application.getByText("Bracket selected · move tool")).toBeTruthy();
  fireEvent.click(application.getByRole("button", { name: "Timeline" }));
  fireEvent.click(application.getByRole("button", { name: "Timeline" }));
  expect(application.getByText("Timeline / bottom dock · center column")).toBeTruthy();
});


test("unavailable window APIs give recoverable feedback without replacing the gallery", () => {
  vi.spyOn(window, "open").mockImplementation(() => { throw new Error("Popup unavailable"); });
  render(<WorkspaceDemoDirectory />);
  fireEvent.click(screen.getByRole("button", { name: /^Sidebar workspace/ }));
  expect(screen.getByRole("dialog", { name: "Sidebar workspace" }).textContent).toContain("blocked");
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getAllByRole("button")).toHaveLength(WORKSPACE_DEMOS.length);
});

test("workspace windows show only the app's own content with no extra showcase header", () => {
  const { container } = render(<WorkspaceDemoWindow id="app-wireframe"><div>App content</div></WorkspaceDemoWindow>);
  expect(screen.getByRole("main", { name: "Standard app layout" }).textContent).toBe("App content");
  expect(container.querySelector(".workspace-demo-window-header")).toBeNull();
  expect(screen.queryByRole("link")).toBeNull();
  expect(document.title).toBe("Standard app layout · Aether UI");
});

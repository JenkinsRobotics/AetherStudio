import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useState } from "react";
import { DEFAULT_WORKSPACE_CHROME, readWorkspaceChrome, resolveSidebarAttachment, setWorkspaceChrome, CHROME_PREFERENCES_KEY } from "./WorkspaceChromePreferences";
import { WorkspaceShell } from "./WorkspaceShell";
import { WorkspaceRibbon } from "./WorkspaceRibbon";
import { SettingsWindow } from "./SettingsWindow";
import { TabbedSidebar } from "./TabbedSidebar";
import { KitShellProvider, useKitShell } from "./kit/shell";
import { defaultLayout } from "./kit/state";

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

test("defaults and legacy auto resolve to the combined card; detached remains explicit", () => {
  for (const raw of [null, "oops", "null", '{"sidebarAttachment":"bad"}', '{"sidebarAttachment":"auto"}']) expect(readWorkspaceChrome(raw)).toEqual(DEFAULT_WORKSPACE_CHROME);
  expect(DEFAULT_WORKSPACE_CHROME.sidebarAttachment).toBe("attached");
  expect(resolveSidebarAttachment("auto")).toBe("attached");
  expect(resolveSidebarAttachment("attached")).toBe("attached");
  expect(resolveSidebarAttachment("detached")).toBe("detached");
  expect(readWorkspaceChrome('{"sidebarAttachment":"detached","sidebarDesign":"rail"}').sidebarAttachment).toBe("detached");
});

test("legacy automatic settings use a combined card and explicit secondary choice updates live", () => {
  localStorage.setItem(CHROME_PREFERENCES_KEY, '{"sidebarAttachment":"auto"}');
  render(<TabbedSidebar tabs={[{ id: "a", label: "Tools", icon: null }]} activeTab="a" onTabChange={() => {}} ariaLabel="Sidebar">Content</TabbedSidebar>);
  const sidebar = screen.getByRole("complementary", { name: "Sidebar" });
  expect(sidebar.getAttribute("data-attachment")).toBe("attached");
  act(() => setWorkspaceChrome({ sidebarAttachment: "detached" }));
  expect(sidebar.getAttribute("data-attachment")).toBe("detached");
  expect(JSON.parse(localStorage.getItem(CHROME_PREFERENCES_KEY)!).sidebarAttachment).toBe("detached");
  act(() => setWorkspaceChrome(DEFAULT_WORKSPACE_CHROME));
  expect(sidebar.getAttribute("data-attachment")).toBe("attached");
});

test("every settings window supplies a shared chrome page that updates live consumers and resets", () => {
  const { container } = render(<>
    <SettingsWindow open title="Product settings" sections={[]} activePaneID="" onSelectPane={() => {}} onClose={() => {}}>Product</SettingsWindow>
    <WorkspaceShell preset="floating" sidebarVariant="rail" defaultOpenLeft={["a"]} leftPanels={[{id:"a",title:"Editor",icon:null,content:<input aria-label="Draft" defaultValue="keep me"/>}]}>Workspace</WorkspaceShell>
    <WorkspaceRibbon workspaceID="a" workspaces={[{id:"a",label:"Design"}]} onWorkspaceSelect={() => {}} activeTabID="a" tabs={[{id:"a",label:"Tools",groups:[]}]} onTabSelect={() => {}} onCommand={() => {}} />
  </>);
  fireEvent.click(screen.getByRole("button", { name: "Toolbars & tabs" }));
  fireEvent.change(screen.getByRole("combobox", {name:"Sidebar tab placement"}), { target: { value: "tabs-bottom" } });
  fireEvent.change(screen.getByRole("combobox", {name:"Sidebar container"}), { target: { value: "attached" } });
  expect(container.querySelector(".aui-tabbed-sidebar")?.getAttribute("data-attachment")).toBe("attached");
  expect(container.querySelector(".aui-tabbed-sidebar")?.getAttribute("data-tabs")).toBe("bottom");
  expect((screen.getByLabelText("Draft") as HTMLInputElement).value).toBe("keep me");
  fireEvent.change(screen.getByRole("combobox", {name:"Toolbar density"}), { target: { value: "compact" } });
  expect(container.querySelector(".aui-workspace-ribbon")?.getAttribute("data-density")).toBe("compact");
  fireEvent.click(screen.getByRole("button", { name: "Restore toolbar and sidebar defaults" }));
  expect(container.querySelector(".aui-shell")?.getAttribute("data-sidebar-variant")).toBe("rail");
  expect(container.querySelector(".aui-workspace-ribbon")?.getAttribute("data-density")).toBe("expanded");
});

test("shared density reaches the kit toolbar and functional local setters remain coherent", () => {
  function Probe() {
    const { ribbon, setRibbon } = useKitShell();
    return <button onClick={() => setRibbon(previous => ({...previous,density:"expanded"}))}>{ribbon.density} / {ribbon.popupStyle}</button>;
  }
  function Host() { const [layout,setLayout] = useState(defaultLayout); return <KitShellProvider layout={layout} setLayout={setLayout}><Probe /></KitShellProvider>; }
  render(<Host />);
  act(() => setWorkspaceChrome({ toolbarDensity:"compact",toolPopup:"grid" }));
  fireEvent.click(screen.getByRole("button",{name:"compact / grid"}));
  expect(screen.getByRole("button",{name:"expanded / grid"})).toBeTruthy();
  expect(readWorkspaceChrome(localStorage.getItem(CHROME_PREFERENCES_KEY)).toolbarDensity).toBe("expanded");
});

import { fireEvent, render, screen, within } from "@testing-library/react";
import { useContext, useState } from "react";
import { expect, test, vi } from "vitest";
import { TabbedSidebar } from "./TabbedSidebar";
import { WorkspaceShell } from "./WorkspaceShell";
import { TabbedSidebarDemo } from "../gallery/TabbedSidebarDemo";
import { CollectionHost } from "./CollectionView";

const tabs = [{ id: "properties", label: "Properties", icon: null }, { id: "layers", label: "Layers", icon: null }];

test.each(["top", "bottom", "left", "right"] as const)("slim sidebar keeps %s placement on a horizontal anchor", edge => {
  render(<TabbedSidebar variant="slim" tabs={tabs} activeTab="properties" onTabChange={() => {}}
    tabPosition={edge} anchor={edge} ariaLabel="Slim inspector" />);
  const sidebar = screen.getByRole("complementary");
  expect(sidebar.getAttribute("data-tabs")).toBe(edge === "bottom" ? "bottom" : "top");
  expect(sidebar.getAttribute("data-anchor")).toBe(edge === "bottom" ? "bottom" : "top");
  expect(screen.getByRole("toolbar").getAttribute("aria-orientation")).toBe("horizontal");
  const first = screen.getByRole("button", { name: "Properties" });
  first.focus();
  fireEvent.keyDown(first, { key: "ArrowRight" });
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Layers" }));
});

test("reference inspector lock controls disable the corresponding field", () => {
  render(<WorkspaceShell preset="docked"><TabbedSidebarDemo /></WorkspaceShell>);
  const top = within(screen.getByRole("region", { name: "Sidebar workspace" }));
  fireEvent.click(top.getByRole("button", { name: "Lock Location X" }));
  expect((top.getByLabelText("Location X") as HTMLInputElement).disabled).toBe(true);
});

test("horizontal tabs support keyboard navigation without discarding the current editor", () => {
  const onChange = vi.fn();
  render(<TabbedSidebar tabs={tabs} activeTab="properties" onTabChange={onChange} ariaLabel="Inspector">Editor</TabbedSidebar>);
  const first = screen.getByRole("button", { name: "Properties" });
  const last = screen.getByRole("button", { name: "Layers" });
  first.focus();
  fireEvent.keyDown(first, { key: "ArrowRight" });
  expect(document.activeElement).toBe(last);
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.keyDown(last, { key: "ArrowRight" });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: "End" });
  expect(document.activeElement).toBe(last);
  fireEvent.keyDown(last, { key: "Home" });
  expect(document.activeElement).toBe(first);
  fireEvent.click(first);
  expect(onChange).toHaveBeenCalledWith(null);
  fireEvent.click(last);
  expect(onChange).toHaveBeenCalledWith("layers");
});

test("closed sidebar retains an accessible reopen control", () => {
  function Demo() {
    const [active, setActive] = useState<string | null>("properties");
    return <TabbedSidebar tabs={tabs} activeTab={active} onTabChange={setActive} tabPosition="bottom" ariaLabel="Inspector">Editor</TabbedSidebar>;
  }
  render(<Demo />);
  fireEvent.click(screen.getByRole("button", { name: "Properties" }));
  expect(screen.queryByText("Editor")).toBeNull();
  expect(screen.getByRole("button", { name: "Properties" }).tabIndex).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: "Layers" }));
  expect(screen.getByText("Editor")).not.toBeNull();
  expect(screen.getByRole("button", { name: "Layers" }).getAttribute("aria-pressed")).toBe("true");
});

test.each(["rail", "tabs-top", "tabs-bottom"] as const)("%s retains edits across switching, collapse, placement and layout", variant => {
  const panels = tabs.map(tab => ({ ...tab, title: tab.label, content: tab.id === "properties" ? <input aria-label="Draft" defaultValue="initial" /> : <p>Layers editor</p> }));
  const props = { sidebarVariant: variant, rightPanels: panels, defaultOpenRight: ["properties"], animatePanels: false } as const;
  const view = render(<WorkspaceShell {...props} preset="floating">Workspace</WorkspaceShell>);
  const input = screen.getByLabelText("Draft") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "unsaved change" } });
  const rail = () => within(screen.getByRole("toolbar", { name: "Right sidebar tabs" }));
  fireEvent.click(rail().getByRole("button", { name: "Layers" }));
  expect(screen.getByText("Layers editor").closest("[hidden]")).toBeNull();
  expect(input.closest("[hidden]")).not.toBeNull();
  fireEvent.click(rail().getByRole("button", { name: "Layers" }));
  expect(screen.getByRole("complementary", { name: "Right sidebar" }).getAttribute("data-expanded")).toBe("false");
  fireEvent.click(rail().getByRole("button", { name: "Properties" }));
  expect(screen.getByLabelText("Draft")).toBe(input);
  expect(input.value).toBe("unsaved change");
  expect(screen.queryByRole("button", { name: "Float Properties" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Close Properties" })).toBeNull();
  expect(view.container.querySelector(".aui-shell-panel-header")).toBeNull();
  view.rerender(<WorkspaceShell {...props} preset="docked">Workspace</WorkspaceShell>);
  expect(input.value).toBe("unsaved change");
  expect(input.closest(".aui-shell-side--right")).not.toBeNull();
  view.rerender(<WorkspaceShell {...props} preset="floating" sidebarVariant="rail">Workspace</WorkspaceShell>);
  expect(input.value).toBe("unsaved change");
  expect(input.closest(".aui-tabbed-sidebar-content")).not.toBeNull();
  expect(screen.queryByRole("button", { name: "Float Properties" })).toBeNull();
});

test("tabbed sidebars restore detached panels and omit collection window commands", () => {
  function Controls() {
    const { controls = [] } = useContext(CollectionHost);
    return <>{controls.map(control => <button key={control.id}>{control.label}</button>)}<input aria-label="Collection draft" defaultValue="saved" /></>;
  }
  const onChange = vi.fn();
  const { container } = render(<WorkspaceShell preset="floating" sidebarVariant="tabs-top"
    leftPanels={[{ id: "layers", title: "Layers", icon: null, collection: true, content: <Controls /> }]}
    panelState={{ layers: { placement: "floating", position: { x: 140, y: 60 } } }} onPanelStateChange={onChange}>Workspace</WorkspaceShell>);
  expect(container.querySelector(".aui-float-panel")).toBeNull();
  expect(screen.getByLabelText("Collection draft").closest(".aui-tabbed-sidebar-content")).not.toBeNull();
  expect(onChange).toHaveBeenCalledWith({ layers: { placement: "docked" } });
  expect(screen.queryByRole("button", { name: /^(Float|Dock|Close) Layers$/ })).toBeNull();
});

test("tabbed variant normalizes previously stacked panels independently on each side", () => {
  const panels = tabs.map(tab => ({ ...tab, title: tab.label, content: tab.label }));
  render(<WorkspaceShell preset="floating" sidebarVariant="tabs-top" panelSelection="multiple"
    leftPanels={panels} rightPanels={[{ id: "info", title: "Info", icon: null, content: "Info editor" }]}
    defaultOpenLeft={["properties", "layers"]} defaultOpenRight={["info"]}>Workspace</WorkspaceShell>);
  expect(screen.getByRole("button", { name: "Properties" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "Layers" }).getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByRole("button", { name: "Info" }).getAttribute("aria-pressed")).toBe("true");
});

 test.each(["left", "right"] as const)("%s tray uses vertical arrow navigation", position => {
  render(<TabbedSidebar tabs={tabs} activeTab="properties" onTabChange={() => {}} tabPosition={position} ariaLabel="Inspector" />);
  const first = screen.getByRole("button", {name:"Properties"});
  const last = screen.getByRole("button", {name:"Layers"});
  expect(screen.getByRole("toolbar").getAttribute("aria-orientation")).toBe("vertical");
  first.focus();
  fireEvent.keyDown(first, {key:"ArrowDown"});
  expect(document.activeElement).toBe(last);
  fireEvent.keyDown(last, {key:"ArrowUp"});
  expect(document.activeElement).toBe(first);
});

test.each([
  ["rail", false, "left", "right"], ["rail", true, "right", "left"],
  ["tabs-top", false, "top", "top"], ["tabs-top", true, "bottom", "bottom"],
  ["tabs-bottom", false, "bottom", "bottom"], ["tabs-bottom", true, "top", "top"],
] as const)("%s separates tray anchor and outside=%s opening", (variant, outside, left, right) => {
  render(<WorkspaceShell preset="floating" sidebarVariant={variant} panelsOnOuterEdge={outside}
    leftPanels={[{id:"left",title:"Left editor",icon:null,content:"Left"}]}
    rightPanels={[{id:"right",title:"Right editor",icon:null,content:"Right"}]}>Workspace</WorkspaceShell>);
  expect(screen.getByRole("complementary", {name:"Left sidebar"}).getAttribute("data-tabs")).toBe(left);
  expect(screen.getByRole("complementary", {name:"Right sidebar"}).getAttribute("data-tabs")).toBe(right);
  for (const side of ["Left", "Right"] as const) {
    const sidebar = screen.getByRole("complementary", { name: `${side} sidebar` });
    const anchor = variant === "rail" ? side.toLowerCase() : variant === "tabs-top" ? "top" : "bottom";
    expect(sidebar.getAttribute("data-anchor")).toBe(anchor);
    fireEvent.click(within(sidebar).getByRole("button", { name: `${side} editor` }));
    expect(sidebar.getAttribute("data-anchor")).toBe(anchor);
  }
});

test.each(["top", "bottom", "left", "right"] as const)("demo anchors %s to the named edge with matching orientation", edge => {
  render(<TabbedSidebarDemo />);
  const region = screen.getByRole("region", { name: "Sidebar workspace" });
  fireEvent.contextMenu(region, { clientX: 40, clientY: 40 });
  fireEvent.click(screen.getByRole("menuitemradio", { name: `Anchor ${edge}` }));
  const sidebar = within(region).getByRole("complementary");
  expect(sidebar.getAttribute("data-anchor")).toBe(edge);
  expect(within(sidebar).getByRole("toolbar").getAttribute("aria-orientation")).toBe(edge === "left" || edge === "right" ? "vertical" : "horizontal");
  fireEvent.click(within(sidebar).getByRole("button", { name: "Properties" }));
  expect(sidebar.getAttribute("data-open")).toBe("false");
  fireEvent.click(within(sidebar).getByRole("button", { name: "Properties" }));
  expect(within(region).getByLabelText("Location X")).toBeTruthy();
});

test("the sidebar demo is one widget whose right-click options update it in place", () => {
  render(<TabbedSidebarDemo />);
  const region = screen.getByRole("region", { name: "Sidebar workspace" });
  expect(region.querySelectorAll(".aui-tabbed-sidebar")).toHaveLength(1);
  expect(region.querySelector('.aui-tabbed-sidebar[data-attachment="attached"]')).not.toBeNull();
  fireEvent.contextMenu(region, { clientX: 40, clientY: 40 });
  fireEvent.click(screen.getByRole("menuitemradio", { name: "Detached — separate tray" }));
  expect(region.querySelector('.aui-tabbed-sidebar[data-attachment="detached"]')).not.toBeNull();
});

test.each(["top", "bottom"] as const)("%s anchor resizes from the opposite edge even with reversed tabs", anchor => {
  const onHeightChange = vi.fn();
  render(<TabbedSidebar tabs={tabs} activeTab="properties" onTabChange={() => {}} anchor={anchor}
    tabPosition={anchor === "top" ? "bottom" : "top"} floating ariaLabel="Inspector"
    resize={{ side: "right", width: 320, maxWidth: 600, onWidthChange: () => {}, onHeightChange, onResetWidth: () => {}, onResetHeight: () => {} }} />);
  const handle = screen.getByRole("separator", { name: "Resize right sidebar height" });
  vi.spyOn(screen.getByRole("complementary", { name: "Inspector" }), "getBoundingClientRect").mockReturnValue({ height: 240 } as DOMRect);
  expect(handle.getAttribute("data-edge")).toBe(anchor === "top" ? "bottom" : "top");
  fireEvent.keyDown(handle, { key: anchor === "top" ? "ArrowDown" : "ArrowUp" });
  expect(onHeightChange).toHaveBeenCalledWith(250);
});

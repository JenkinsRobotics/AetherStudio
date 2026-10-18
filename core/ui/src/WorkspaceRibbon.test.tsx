import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, test, vi } from "vitest";
import { WorkspaceRibbon, type WorkspaceRibbonProps } from "./WorkspaceRibbon";
import { WorkspaceShell } from "./WorkspaceShell";

const sampleRibbon: WorkspaceRibbonProps = {
  workspaceID: "design", workspaces: [{ id: "design", label: "Design" }, { id: "show", label: "Show" }],
  onWorkspaceSelect: () => {}, activeTabID: "solid", onTabSelect: () => {}, onCommand: () => {},
  tabs: [
    { id: "solid", label: "Solid", groups: [{ id: "create", label: "Create", tools: [
      { id: "extrude", label: "Extrude", icon: <span /> },
      { id: "cut", label: "Cut", icon: <span />, disabled: true, disabledReason: "Select a body first" },
    ] }] },
    { id: "output", label: "Output", groups: [{ id: "output", label: "Output", tools: [{ id: "export", label: "Export", icon: <span /> }] }] },
  ],
};

test("standard toolbar follows its host layout without application styling flags", () => {
  const toolbar = <WorkspaceRibbon {...sampleRibbon} />;
  const view = render(<WorkspaceShell preset="docked" toolbar={toolbar}>Canvas</WorkspaceShell>);
  const attributes = () => view.container.querySelector('.aui-workspace-ribbon')!;
  expect(attributes().getAttribute('data-docked')).not.toBeNull();
  expect(attributes().getAttribute('data-appearance')).toBe('glass');
  expect(attributes().getAttribute('data-workspace-layout')).toBe('column');
  view.rerender(<WorkspaceShell preset="floating" toolbar={toolbar}>Canvas</WorkspaceShell>);
  expect(attributes().getAttribute('data-docked')).toBeNull();
  expect(view.container.querySelector('.aui-shell-fltoolbar')?.getAttribute('data-toolbar-frame')).toBe('auto');
});

test("workspace switching and keyboard tab navigation emit controlled selection", () => {
  const selectWorkspace = vi.fn();
  function Example() {
    const [activeTabID, onTabSelect] = useState("solid");
    return <WorkspaceRibbon {...sampleRibbon} {...{ activeTabID, onTabSelect }} onWorkspaceSelect={selectWorkspace} />;
  }
  render(<Example />);
  fireEvent.click(screen.getByRole("button", { name: "Workspace: Design" }));
  fireEvent.click(screen.getByRole("menuitemradio", { name: "Show" }));
  expect(selectWorkspace).toHaveBeenCalledWith("show");
  const solid = screen.getByRole("tab", { name: "Solid" });
  solid.focus(); fireEvent.keyDown(solid, { key: "ArrowRight" });
  expect(screen.getByRole("tab", { name: "Output" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.queryByRole("button", { name: "Extrude" })).toBeNull();
  expect(screen.getByRole("button", { name: "Export" })).toBeTruthy();
});

test("tools and caption menu dispatch the same commands and preserve disabled reasons", () => {
  const onCommand = vi.fn();
  render(<WorkspaceRibbon {...sampleRibbon} onCommand={onCommand} />);
  fireEvent.click(screen.getByRole("button", { name: "Extrude" }));
  expect(onCommand).toHaveBeenLastCalledWith("extrude");
  const cut = screen.getByRole("button", { name: "Cut" }) as HTMLButtonElement;
  expect(cut.disabled).toBe(true); expect(cut.title).toBe("Select a body first");
  fireEvent.click(cut); expect(onCommand).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Create tools" }));
  const menu = screen.getByRole("menu");
  expect((within(menu).getByRole("menuitem", { name: /Cut/ }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(within(menu).getByRole("menuitem", { name: "Extrude" }));
  expect(onCommand).toHaveBeenCalledTimes(2);
  expect(onCommand).toHaveBeenLastCalledWith("extrude");
});

test("full caption menus can expose commands beyond the prominent ribbon tools", () => {
  const onCommand = vi.fn();
  render(<WorkspaceRibbon {...sampleRibbon} onCommand={onCommand} tabs={[{
    ...sampleRibbon.tabs[0], groups: [{ ...sampleRibbon.tabs[0].groups[0], menuItems: [{ id: "extra", label: "Additional tool" }] }],
  }]} />);
  fireEvent.click(screen.getByRole("button", { name: "Create tools" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Additional tool" }));
  expect(onCommand).toHaveBeenCalledWith("extra");
});

describe("workspace layout", () => {
  const workspaces = [{ id: "design", label: "Design" }, { id: "render", label: "Render" }];
  const tabs = [{ id: "solid", label: "Solid", groups: [] }];
  const ribbon = (layout?: "strip" | "column") => (
    <WorkspaceRibbon workspaces={workspaces} workspaceID="design" onWorkspaceSelect={() => {}}
      tabs={tabs} activeTabID="solid" onTabSelect={() => {}} onCommand={() => {}}
      workspaceLayout={layout} />
  );

  it("keeps the tab strip available as an explicit variant", () => {
    render(ribbon("strip"));
    const strip = screen.getByRole("navigation", { name: "Workspace tools" });
    expect(within(strip).getByRole("tab", { name: "Design" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Workspace:/ })).toBeNull();
  });

  it("draws the standard workspace column by default", () => {
    render(ribbon());
    const strip = screen.getByRole("navigation", { name: "Workspace tools" });
    // A workspace is not a tool tab: choosing one changes which tool tabs exist.
    expect(within(strip).queryByRole("tab", { name: "Design" })).toBeNull();
    expect(within(strip).getByRole("tab", { name: "Solid" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Workspace: Design" })).toBeTruthy();
  });
});

test("glass is the default and panel remains an explicit appearance", () => {
  const glass = render(<WorkspaceRibbon {...sampleRibbon} />);
  expect(glass.container.querySelector(".aui-workspace-ribbon")?.getAttribute("data-appearance")).toBe("glass");
  expect(within(glass.container).getByRole("button", { name: "Extrude" })).toBeTruthy();
  glass.unmount();
  const plain = render(<WorkspaceRibbon {...sampleRibbon} appearance="panel" />);
  expect(plain.container.querySelector(".aui-workspace-ribbon")?.getAttribute("data-appearance")).toBe("panel");
});

test("moreItems adds a trailing dots menu that routes through onCommand", () => {
  const onCommand = vi.fn();
  render(<WorkspaceRibbon {...sampleRibbon} onCommand={onCommand} moreItems={[{ id: "customize", label: "Customize toolbar…" }]} />);
  fireEvent.click(screen.getByRole("button", { name: "More tools" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Customize toolbar…" }));
  expect(onCommand).toHaveBeenCalledWith("customize");
});

test("every ribbon dropdown is a tool menu: a captioned, icon-and-label panel", () => {
  render(<WorkspaceRibbon {...sampleRibbon} workspaceLayout="column" moreItems={[{ id: "reset", label: "Reset ribbon" }]} />);
  fireEvent.click(screen.getByRole("button", { name: "Create tools" }));
  let menu = screen.getByRole("menu", { name: "Create tools" });
  expect(menu.classList.contains("aui-tool-menu")).toBe(true);
  expect(within(menu).getByText("Create")).toBeTruthy();
  fireEvent.keyDown(menu, { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "Workspace: Design" }));
  menu = screen.getByRole("menu", { name: "Workspace: Design" });
  expect(menu.classList.contains("aui-tool-menu")).toBe(true);
  expect(within(menu).getByText("Workspace")).toBeTruthy();
  fireEvent.keyDown(menu, { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "More tools" }));
  menu = screen.getByRole("menu", { name: "More tools" });
  expect(menu.classList.contains("aui-tool-menu")).toBe(true);
  expect(within(menu).getByText("Toolbar")).toBeTruthy();
});

test("the ••• menu changes tool density without removing workspace navigation", () => {
  render(<WorkspaceRibbon {...sampleRibbon} workspaceLayout="column" appearance="glass" />);
  expect(screen.getByRole("button", { name: "Workspace: Design" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "More tools" }));
  expect(screen.getByRole("menuitemradio", { name: /Expanded/ }).getAttribute("aria-checked")).toBe("true");
  fireEvent.click(screen.getByRole("menuitemradio", { name: /Compact/ }));
  expect(screen.getByRole("button", { name: "Workspace: Design" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Extrude" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Create tools" }));
  expect(within(screen.getByRole("menu", { name: "Create tools" })).getByRole("menuitem", { name: "Extrude" })).toBeTruthy();
  fireEvent.keyDown(screen.getByRole("menu", { name: "Create tools" }), { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "More tools" }));
  fireEvent.click(screen.getByRole("menuitemradio", { name: /Standard/ }));
  expect(screen.getByRole("button", { name: "Extrude" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Workspace: Design" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "More tools" }));
  fireEvent.click(screen.getByRole("menuitemradio", { name: /Expanded/ }));
  expect(screen.getByRole("button", { name: "Workspace: Design" })).toBeTruthy();
});


test("glass ribbon exposes docking independently of density and menu anchoring", () => {
  const { container } = render(<WorkspaceRibbon {...sampleRibbon} appearance="glass" docked defaultDensity="compact" />);
  const ribbon = container.querySelector(".aui-workspace-ribbon")!;
  expect(ribbon.hasAttribute("data-docked")).toBe(true);
  expect(ribbon.hasAttribute("data-toolbar-menu-boundary")).toBe(true);
  expect(ribbon.getAttribute("data-density")).toBe("compact");
  fireEvent.click(screen.getByRole("button", { name: "More tools" }));
  fireEvent.click(screen.getByRole("menuitemradio", { name: /Standard/ }));
  expect(ribbon.getAttribute("data-density")).toBe("standard");
});

test("a tool with variants offers them from its own caret and from the group caption, and reports the one chosen", () => {
  const chosen: string[] = [];
  render(
    <WorkspaceRibbon
      workspaces={[{ id: "design", label: "Design" }]} workspaceID="design" onWorkspaceSelect={() => {}}
      tabs={[{ id: "sketch", label: "Sketch", groups: [{ id: "draw", label: "Draw", tools: [
        { id: "rectangle", label: "Center rectangle", icon: <i />, selectedVariantID: "center-rectangle", variants: [
          { id: "rectangle", label: "Rectangle", icon: <i /> },
          { id: "center-rectangle", label: "Center rectangle", icon: <i /> },
          { id: "aligned-rectangle", label: "Aligned rectangle", icon: <i />, disabled: true, disabledReason: "Pick a face first." },
        ] },
        { id: "circle", label: "Circle", icon: <i /> },
      ] }] }]}
      activeTabID="sketch" onTabSelect={() => {}} onCommand={(id) => chosen.push(id)}
    />,
  );
  // The button is the current variant; the caret beside it picks another.
  fireEvent.click(screen.getByRole("button", { name: "Rectangle variants" }));
  const menu = screen.getByRole("menu", { name: "Rectangle variants" });
  // The button keeps the family id while showing the chosen variant.
  expect(within(menu).getByRole("menuitemradio", { name: "Center rectangle" }).getAttribute("aria-checked")).toBe("true");
  expect(within(menu).getByRole("menuitemradio", { name: "Rectangle" }).getAttribute("aria-checked")).toBe("false");
  expect((within(menu).getByRole("menuitemradio", { name: "Aligned rectangle" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(within(menu).getByRole("menuitemradio", { name: "Aligned rectangle" }));
  expect(chosen).toEqual([]);
  fireEvent.click(within(menu).getByRole("menuitemradio", { name: "Rectangle" }));
  expect(chosen).toEqual(["rectangle"]);

  // A tool without variants has no caret, and the caption menu still reaches
  // every variant so nothing is hidden behind one.
  expect(screen.queryByRole("button", { name: "Circle variants" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Draw tools" }));
  const caption = screen.getByRole("menu", { name: "Draw tools" });
  // A tool with variants contributes its variants, not itself, so the family
  // appears once per real command.
  for (const label of ["Rectangle", "Center rectangle", "Aligned rectangle", "Circle"]) {
    expect(within(caption).getAllByRole("menuitem", { name: label })).toHaveLength(1);
  }
});

test.each(["compact", "standard", "expanded"] as const)("column workspace switcher remains usable at %s density", (density) => {
  const onWorkspaceSelect = vi.fn();
  render(<WorkspaceRibbon {...sampleRibbon} workspaceLayout="column" density={density} onWorkspaceSelect={onWorkspaceSelect} />);
  fireEvent.click(screen.getByRole("button", { name: "Workspace: Design" }));
  fireEvent.click(screen.getByRole("menuitemradio", { name: "Show" }));
  expect(onWorkspaceSelect).toHaveBeenCalledWith("show");
});


test("host-owned workspace navigation omits the selector while retaining tools", () => {
  const command = vi.fn();
  const view = render(<WorkspaceRibbon {...sampleRibbon} workspaceLayout="none" onCommand={command} />);
  expect(view.container.querySelector('.aui-workspace-ribbon-workspaces')).toBeNull();
  expect(screen.queryByRole('button', { name: /Workspace:/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Extrude' }));
  expect(command).toHaveBeenCalledWith('extrude');
});

test("with no workspaces the ribbon leaves the switcher to the app's header", () => {
  const { container } = render(<WorkspaceRibbon {...sampleRibbon} workspaces={[]} workspaceLayout="column" />);
  expect(container.querySelector(".aui-workspace-ribbon-workspaces")).toBeNull();
  expect(screen.getByRole("button", { name: /Extrude/ })).toBeTruthy();
});

test("compact icon strip exposes cross-category tools without tabs and restores expanded tabs", () => {
  const onCommand = vi.fn();
  const groups = sampleRibbon.tabs.flatMap((tab) => tab.groups);
  const view = render(<WorkspaceRibbon {...sampleRibbon} density="compact" compactGroups={groups} onCommand={onCommand} />);
  expect(screen.queryByRole('tab')).toBeNull();
  expect(screen.queryByRole('button', {name:'Workspace: Design'})).toBeNull();
  fireEvent.click(screen.getByRole('button', {name:'Extrude'}));
  expect(onCommand).toHaveBeenLastCalledWith('extrude');
  fireEvent.click(screen.getByRole('button', {name:'Export'}));
  expect(onCommand).toHaveBeenLastCalledWith('export');
  expect((screen.getByRole('button', {name:'Cut'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', {name:'Create tools'}));
  expect(screen.getByRole('menuitem', {name:'Extrude'})).toBeTruthy();
  view.rerender(<WorkspaceRibbon {...sampleRibbon} density="expanded" compactGroups={groups} />);
  expect(screen.getByRole('tab', {name:'Solid'})).toBeTruthy();
});

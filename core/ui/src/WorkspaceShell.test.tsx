import { Inspector } from "./Inspector";
import { FieldRow } from "./FieldRow";
import { TextField } from "./TextField";
import { TreePanel } from "./TreePanel";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef, useState } from "react";
import { expect, test, vi } from "vitest";
import {
  LayoutPresetButton,
  WorkspaceShell,
  nextLayoutPreset,
  type WorkspacePanelState,
  type WorkspaceShellHandle,
} from "./WorkspaceShell";
import { ViewportCanvas } from "./ViewportCanvas";

// Preserved editor hosts remain mounted under a hidden ancestor after closing.
function visibleText(text: string) {
  const element = screen.queryByText(text);
  return element?.closest('[hidden]') ? null : element;
}

const panels = [
  { id: "parts", title: "Parts", icon: "▣", content: <div>parts-content</div> },
];

const sideEditors = [
  { id: "parts", title: "Parts", icon: "", content: <input aria-label="Part draft" defaultValue="draft" /> },
  { id: "history", title: "History", icon: "", content: <div>History editor</div> },
];

test("sidebar selection is exclusive per side and preserves drafts across replacement", () => {
  const view = render(<WorkspaceShell preset="docked" leftPanels={sideEditors}
    rightPanels={[{ id: "inspector", title: "Inspector", icon: "", content: "Inspector editor" }]}
    defaultOpenLeft={["parts", "history"]} defaultOpenRight={["inspector"]}>Canvas</WorkspaceShell>);
  const input = screen.getByLabelText("Part draft") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "unfinished edit" } });
  expect(screen.getByLabelText("History").getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(screen.getByLabelText("History"));
  expect(screen.getByLabelText("Parts").getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByLabelText("Inspector").getAttribute("aria-pressed")).toBe("true");
  expect(view.container.querySelectorAll('.aui-shell-side:not(.aui-shell-side--right) .aui-shell-panel')).toHaveLength(1);
  fireEvent.click(screen.getByLabelText("Parts"));
  expect(screen.getByLabelText("Part draft")).toBe(input);
  expect(input.value).toBe("unfinished edit");
  expect(screen.queryByLabelText("Float Parts")).toBeNull();
  fireEvent.click(screen.getByLabelText("History"));
  expect(view.container.querySelector('.aui-float-panel')).toBeNull();
  expect(screen.getByLabelText("History").getAttribute("aria-pressed")).toBe("true");
});

test("old saved multi-panel layouts are normalized and saved with only one selected", async () => {
  const key = "test-exclusive-sidebar";
  localStorage.setItem(key, JSON.stringify({ version: 1, layouts: { docked: {
    parts: { placement: "docked" }, history: { placement: "docked" },
  } } }));
  render(<WorkspaceShell preset="docked" storageKey={key} leftPanels={sideEditors}>Canvas</WorkspaceShell>);
  expect(screen.getByLabelText("Parts").getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByLabelText("History").getAttribute("aria-pressed")).toBe("false");
  await waitFor(() => expect(JSON.parse(localStorage.getItem(key)!).layouts.docked.history.placement).toBe("hidden"));
  localStorage.removeItem(key);
});

test("controlled external opening replaces the current panel; multiple remains an explicit option", () => {
  const onChange = vi.fn();
  const view = render(<WorkspaceShell preset="floating" leftPanels={sideEditors} panelState={{ parts: { placement: "docked" } }}
    onPanelStateChange={onChange}>Canvas</WorkspaceShell>);
  const both: WorkspacePanelState = { parts: { placement: "docked" }, history: { placement: "docked" } };
  view.rerender(<WorkspaceShell preset="floating" leftPanels={sideEditors} panelState={both} onPanelStateChange={onChange}>Canvas</WorkspaceShell>);
  expect(screen.getByLabelText("Parts").getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByLabelText("History").getAttribute("aria-pressed")).toBe("true");
  expect(onChange).toHaveBeenLastCalledWith({ parts: { placement: "hidden" }, history: { placement: "docked" } });
  view.rerender(<WorkspaceShell preset="floating" leftPanels={sideEditors} panelState={{...both}} onPanelStateChange={onChange}>Canvas</WorkspaceShell>);
  expect(screen.getByLabelText("History").getAttribute("aria-pressed")).toBe("true");
  view.rerender(<WorkspaceShell preset="floating" leftPanels={sideEditors} panelState={both} panelSelection="multiple">Canvas</WorkspaceShell>);
  expect(screen.getByLabelText("Parts").getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByLabelText("History").getAttribute("aria-pressed")).toBe("true");
});

test("safe clearances are measured by default, including floating toolbars and sidebars", () => {
  const bounds = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function(this: HTMLElement) {
    const rect = this.classList.contains("aui-shell-fltoolbar") ? {x:0,y:14,width:1000,height:90}
      : this.classList.contains("aui-shell-fledge--left") ? {x:0,y:0,width:250,height:800}
      : this.classList.contains("aui-shell-fledge--right") ? {x:960,y:0,width:40,height:800}
      : {x:0,y:0,width:1000,height:800};
    return {...rect,top:rect.y,left:rect.x,right:rect.x+rect.width,bottom:rect.y+rect.height,toJSON:()=>rect};
  });
  try {
    const {container} = render(<WorkspaceShell preset="floating" toolbar={<button>Tools</button>}
      leftPanels={panels} defaultOpenLeft={["parts"]}><div>Workspace</div></WorkspaceShell>);
    const shell = container.querySelector('.aui-shell') as HTMLElement;
    expect(shell.dataset.measureInsets).toBe('true');
    expect(shell.style.getPropertyValue('--aui-workspace-inset-top')).toBe('126px');
    expect(shell.style.getPropertyValue('--aui-workspace-inset-left')).toBe('272px');
  } finally { bounds.mockRestore(); }
});

test("embedded workspace chrome does not consume its parent's safe area", () => {
  const bounds = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, width: 1000, height: 800, top: 0, left: 0, right: 1000, bottom: 800, toJSON: () => ({}) });
  try {
    const { container } = render(<WorkspaceShell preset="floating">
      <WorkspaceShell preset="floating" sidebarVariant="tabs-top" toolbar={<button>Embedded tools</button>} leftPanels={panels} defaultOpenLeft={["parts"]}>Preview</WorkspaceShell>
    </WorkspaceShell>);
    const [outer, inner] = Array.from(container.querySelectorAll<HTMLElement>(".aui-shell"));
    expect(outer.style.getPropertyValue("--aui-workspace-inset-top")).toBe("10px");
    expect(outer.style.getPropertyValue("--aui-workspace-inset-left")).toBe("10px");
    expect(inner.style.getPropertyValue("--aui-workspace-inset-top")).toBe("822px");
    expect(inner.style.getPropertyValue("--aui-workspace-inset-left")).toBe("1022px");
  } finally { bounds.mockRestore(); }
});

test("preset cycle order is floating → docked → canvas → floating", () => {
  expect(nextLayoutPreset("floating")).toBe("docked");
  expect(nextLayoutPreset("docked")).toBe("canvas");
  expect(nextLayoutPreset("canvas")).toBe("floating");
  const onChange = vi.fn();
  render(<LayoutPresetButton preset="docked" onChange={onChange} />);
  fireEvent.click(screen.getByLabelText("Layout docked, switch to canvas"));
  expect(onChange).toHaveBeenCalledWith("canvas");
});

test("docked: rail button toggles the panel open and closed", async () => {
  render(
    <WorkspaceShell preset="docked" leftPanels={panels}>
      canvas
    </WorkspaceShell>
  );
  expect(visibleText("parts-content")).toBeNull();
  fireEvent.click(screen.getByLabelText("Parts"));
  expect(visibleText("parts-content")).not.toBeNull();
  fireEvent.click(screen.getByLabelText("Parts"));
  await waitFor(() => expect(visibleText("parts-content")).toBeNull());
});

test("float button tears the panel off; dock button restacks it", () => {
  const { container } = render(
    <WorkspaceShell panelSelection="multiple" preset="docked" leftPanels={panels} defaultOpenLeft={["parts"]}>
      canvas
    </WorkspaceShell>
  );
  expect(container.querySelector(".aui-float-panel")).toBeNull();
  fireEvent.click(screen.getByLabelText("Float Parts"));
  expect(container.querySelector(".aui-float-panel")).not.toBeNull();
  expect(visibleText("parts-content")).not.toBeNull();
  fireEvent.click(screen.getByLabelText("Dock Parts"));
  expect(container.querySelector(".aui-float-panel")).toBeNull();
  expect(visibleText("parts-content")).not.toBeNull(); // back in the stack
});

test("canvas preset hides chrome until the edge hot-zone is hovered", () => {
  const { container } = render(
    <WorkspaceShell preset="canvas" leftPanels={panels} defaultOpenLeft={["parts"]}>
      canvas
    </WorkspaceShell>
  );
  expect(screen.queryByLabelText("Parts")).toBeNull(); // rail hidden
  expect(container.querySelector(".aui-shell-handle--left")).not.toBeNull();
  fireEvent.mouseEnter(container.querySelector(".aui-shell-edge--left")!);
  expect(screen.queryByLabelText("Parts")).not.toBeNull(); // rail revealed
  expect(visibleText("parts-content")).not.toBeNull();
});

test("floating preset shows chrome overlays without hover", () => {
  const { container } = render(
    <WorkspaceShell
      preset="floating"
      leftPanels={panels}
      defaultOpenLeft={["parts"]}
      toolbar={<div>toolbar-content</div>}
    >
      canvas
    </WorkspaceShell>
  );
  expect(screen.queryByLabelText("Parts")).not.toBeNull();
  expect(visibleText("parts-content")).not.toBeNull();
  expect(visibleText("toolbar-content")).not.toBeNull();
  expect(container.querySelector(".aui-shell")?.getAttribute("data-panel-relationship")).toBe("overlay");
});

test("docked layout pushes the workspace and outer-edge mode moves floating rails inboard", () => {
  const { container, rerender } = render(<WorkspaceShell preset="docked" leftPanels={panels} defaultOpenLeft={["parts"]}>canvas</WorkspaceShell>);
  expect(container.querySelector(".aui-shell")?.getAttribute("data-panel-relationship")).toBe("push");
  rerender(<WorkspaceShell preset="floating" panelsOnOuterEdge leftPanels={panels} defaultOpenLeft={["parts"]}>canvas</WorkspaceShell>);
  expect(container.querySelector(".aui-shell")?.classList.contains("aui-shell--panels-outer-edge")).toBe(true);
  expect(container.querySelector(".aui-tabbed-sidebar")?.getAttribute("data-tabs")).toBe("right");
});

test("layout preset changes preserve one mounted viewport", () => {
  const teardown = vi.fn();
  const onMount = vi.fn(() => teardown);
  const workspace = (preset: "docked" | "floating" | "canvas") => (
    <WorkspaceShell
      preset={preset}
      leftPanels={panels}
      defaultOpenLeft={["parts"]}
      toolbar={<div>toolbar-content</div>}
    >
      <ViewportCanvas onMount={onMount} />
    </WorkspaceShell>
  );

  const { container, rerender, unmount } = render(workspace("docked"));
  const canvas = container.querySelector("canvas");
  expect(canvas).not.toBeNull();
  expect(onMount).toHaveBeenCalledTimes(1);

  rerender(workspace("floating"));
  expect(container.querySelector("canvas")).toBe(canvas);
  expect(onMount).toHaveBeenCalledTimes(1);
  expect(teardown).not.toHaveBeenCalled();

  rerender(workspace("canvas"));
  expect(container.querySelector("canvas")).toBe(canvas);
  expect(onMount).toHaveBeenCalledTimes(1);
  expect(teardown).not.toHaveBeenCalled();

  unmount();
  expect(teardown).toHaveBeenCalledTimes(1);
});

test("controlled panel state persists Dock, Float, Hide, and float position", async () => {
  function ControlledShell() {
    const [panelState, setPanelState] = useState<WorkspacePanelState>({
      parts: { placement: "docked" },
    });
    return (
      <>
        <WorkspaceShell panelSelection="multiple"
          preset="docked"
          leftPanels={panels}
          panelState={panelState}
          onPanelStateChange={setPanelState}
        >
          canvas
        </WorkspaceShell>
        <output data-testid="panel-state">{JSON.stringify(panelState)}</output>
      </>
    );
  }

  const { container } = render(<ControlledShell />);
  fireEvent.click(screen.getByLabelText("Float Parts"));
  expect(container.querySelector(".aui-float-panel")).not.toBeNull();
  expect(screen.getByTestId("panel-state").textContent).toContain(
    '"placement":"floating","position":{"x":64,"y":56}',
  );

  fireEvent.click(screen.getByLabelText("Dock Parts"));
  expect(container.querySelector(".aui-float-panel")).toBeNull();
  expect(screen.getByTestId("panel-state").textContent).toContain(
    '"placement":"docked"',
  );

  fireEvent.click(screen.getByLabelText("Parts"));
  await waitFor(() => expect(visibleText("parts-content")).toBeNull());
  expect(screen.getByTestId("panel-state").textContent).toContain(
    '"placement":"hidden"',
  );
});


test("retained panel preserves its input node and draft across dock, float and hide", () => {
  const content = [{ id: "editor", title: "Editor", icon: "E", content: <input aria-label="Draft" defaultValue="initial" /> }];
  const { rerender } = render(<WorkspaceShell preset="docked" leftPanels={content} panelState={{ editor: { placement: "docked" } }}><canvas /></WorkspaceShell>);
  const input = screen.getByLabelText("Draft") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "unsaved" } });
  for (const placement of ["floating", "hidden", "docked"] as const) {
    rerender(<WorkspaceShell preset="floating" leftPanels={content} panelState={{ editor: { placement } }}><canvas /></WorkspaceShell>);
    expect(screen.getByLabelText("Draft")).toBe(input);
    expect(input.value).toBe("unsaved");
  }
});


test("versioned layouts persist separately per preset and tolerate invalid storage", async () => {
  const key = "aether.test.panels";
  localStorage.setItem(key, "invalid");
  const renderShell = (preset: "docked" | "floating") => <WorkspaceShell preset={preset} storageKey={key} leftPanels={panels} defaultOpenLeft={["parts"]}><canvas /></WorkspaceShell>;
  const { rerender, unmount } = render(renderShell("docked"));
  fireEvent.click(screen.getByLabelText("Parts"));
  await waitFor(() => expect(visibleText("parts-content")).toBeNull());
  rerender(renderShell("floating"));
  expect(screen.getByText("parts-content")).toBeTruthy();
  rerender(renderShell("docked"));
  await waitFor(() => expect(visibleText("parts-content")).toBeNull());
  unmount();
  const restored = render(renderShell("docked"));
  expect(visibleText("parts-content")).toBeNull();
  restored.unmount();
  localStorage.removeItem(key);
});

test("chromeless docked panel renders content without the header chrome", () => {
  const { container } = render(
    <WorkspaceShell preset="docked" leftPanels={[{ id: "tree", title: "Feature tree", icon: "▣", content: <div>tree-content</div>, chromeless: true }]}>
      canvas
    </WorkspaceShell>
  );
  fireEvent.click(screen.getByLabelText("Feature tree"));
  expect(visibleText("tree-content")).not.toBeNull();
  expect(container.querySelector(".aui-shell-panel-header")).toBeNull();
  expect(screen.queryByLabelText("Close Feature tree")).toBeNull();
});

test('collection menus retain docking commands and search state across portal moves', () => {
  render(<WorkspaceShell panelSelection="multiple" preset="docked" preservePanelContent defaultOpenLeft={['items']}
    leftPanels={[{id:'items',title:'Items',icon:'i',collection:true,content:<TreePanel ariaLabel="Items" nodes={[{id:'a',label:'First item'}]} selectedIDs={new Set()} onSelect={()=>{}}/>}]}>Canvas</WorkspaceShell>);
  fireEvent.change(screen.getByRole('searchbox',{name:'Search Items'}),{target:{value:'First'}});
  fireEvent.click(screen.getByRole('button',{name:'More Tree controls'}));
  fireEvent.click(screen.getByRole('menuitem',{name:'Float Items'}));
  expect((screen.getByRole('searchbox',{name:'Search Items'}) as HTMLInputElement).value).toBe('First');
  fireEvent.click(screen.getByRole('button',{name:'More Tree controls'}));
  fireEvent.click(screen.getByRole('menuitem',{name:'Dock Items'}));
  expect((screen.getByRole('searchbox',{name:'Search Items'}) as HTMLInputElement).value).toBe('First');
  fireEvent.click(screen.getByRole('button',{name:'More Tree controls'}));
  fireEvent.click(screen.getByRole('menuitem',{name:'Close Items'}));
  expect(screen.getByRole('button',{name:'Items'}).getAttribute('aria-pressed')).toBe('false');
});


test("animated closing keeps the editor host inert until exit finishes and restores its draft", () => {
  vi.useFakeTimers();
  try {
    const result = render(<WorkspaceShell preset="floating" preservePanelContent defaultOpenLeft={["draft"]}
      leftPanels={[{id:"draft",title:"Draft",icon:"D",content:<input aria-label="Panel draft" defaultValue="saved"/>}]}>Canvas</WorkspaceShell>);
    const input = screen.getByRole("textbox",{name:"Panel draft"}) as HTMLInputElement;
    fireEvent.change(input,{target:{value:"unfinished"}});
    fireEvent.click(screen.getByLabelText("Draft"));
    const closing = result.container.querySelector('.aui-shell-panel[data-closing="true"]');
    expect(closing?.hasAttribute("inert")).toBe(true);
    expect(closing?.contains(input)).toBe(true);
    act(() => vi.advanceTimersByTime(250));
    expect(result.container.querySelector('.aui-shell-panel')).toBeNull();
    fireEvent.click(screen.getByLabelText("Draft"));
    expect(screen.getByRole("textbox",{name:"Panel draft"})).toBe(input);
    expect(input.value).toBe("unfinished");
    result.unmount();
  } finally { vi.useRealTimers(); }
});

test("reopening during exit cancels removal and reduced motion skips retention", () => {
  vi.useFakeTimers();
  try {
    const result = render(<WorkspaceShell preset="docked" animatePanels defaultOpenLeft={["parts"]} leftPanels={panels}>Canvas</WorkspaceShell>);
    fireEvent.click(screen.getByLabelText("Parts"));
    fireEvent.click(screen.getByLabelText("Parts"));
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByText("parts-content")).toBeTruthy();
    expect(result.container.querySelector('[data-closing="true"]')).toBeNull();
    vi.stubGlobal("matchMedia", () => ({matches:true}));
    fireEvent.click(screen.getByLabelText("Parts"));
    expect(visibleText("parts-content")).toBeNull();
    result.unmount();
  } finally { vi.unstubAllGlobals(); vi.useRealTimers(); }
});


test("switching a side's editor does not stack its outgoing panel during motion", () => {
  const editors = [...panels, {id:"history",title:"History",icon:"H",content:<div>history-content</div>}];
  const {container,rerender} = render(<WorkspaceShell preset="floating" leftPanels={editors} panelState={{parts:{placement:"docked"}}}>Canvas</WorkspaceShell>);
  rerender(<WorkspaceShell preset="floating" leftPanels={editors} panelState={{parts:{placement:"hidden"},history:{placement:"docked"}}}>Canvas</WorkspaceShell>);
  expect(container.querySelectorAll('.aui-shell-panel')).toHaveLength(1);
  expect(visibleText("parts-content")).toBeNull();
  expect(screen.getByText("history-content")).toBeTruthy();
});


test("outside placement puts both docked stacks before their workspace-facing rails without losing edits", () => {
  const left = [{ ...panels[0], content: <input aria-label="Panel draft" defaultValue="Draft" /> }];
  const right = [{ id: "inspector", title: "Inspector", icon: "i", content: <div>Inspector content</div> }];
  const view = (outside: boolean) => <WorkspaceShell preset="docked" panelsOnOuterEdge={outside}
    preservePanelContent leftPanels={left} rightPanels={right} defaultOpenLeft={["parts"]} defaultOpenRight={["inspector"]}>Canvas</WorkspaceShell>;
  const { container, rerender } = render(view(true));
  const leftSide = container.querySelector('.aui-shell-side:not(.aui-shell-side--right)')!;
  const rightSide = container.querySelector('.aui-shell-side--right')!;
  expect(leftSide.querySelector('.aui-tabbed-sidebar')?.getAttribute('data-tabs')).toBe('right');
  expect(rightSide.querySelector('.aui-tabbed-sidebar')?.getAttribute('data-tabs')).toBe('left');
  const draft = screen.getByLabelText('Panel draft');
  fireEvent.change(draft, { target: { value: 'Keep this edit' } });
  rerender(view(false));
  expect(leftSide.querySelector('.aui-tabbed-sidebar')?.getAttribute('data-tabs')).toBe('left');
  expect(rightSide.querySelector('.aui-tabbed-sidebar')?.getAttribute('data-tabs')).toBe('right');
  expect(screen.getByLabelText('Panel draft')).toBe(draft);
  expect((draft as HTMLInputElement).value).toBe('Keep this edit');
});


test("showPanel reveals a hidden editor and repeated requests preserve its input", () => {
  const controller = createRef<WorkspaceShellHandle>();
  render(<WorkspaceShell preset="docked" controllerRef={controller} leftPanels={sideEditors}>Canvas</WorkspaceShell>);
  act(() => controller.current!.showPanel("parts"));
  const input = screen.getByLabelText("Part draft") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "unsaved value" } });
  act(() => controller.current!.showPanel("parts"));
  expect(screen.getByLabelText("Parts").getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByLabelText("Part draft")).toBe(input);
  expect(input.value).toBe("unsaved value");
  act(() => controller.current!.showPanel("history"));
  expect(screen.getByLabelText("Parts").getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByLabelText("History").getAttribute("aria-pressed")).toBe("true");
});


test("right-side properties inherit the shared inspector across shell presentations without nested padding", () => {
  const content = <Inspector className="product-inspector"><FieldRow label="Name" help="Property guidance"><TextField aria-label="Property name" defaultValue="Draft" /></FieldRow></Inspector>;
  const props = { rightPanels: [{ id: "properties", title: "Properties", icon: "", content }], defaultOpenRight: ["properties"] };
  const view = render(<WorkspaceShell preset="docked" {...props}>Canvas</WorkspaceShell>);
  const input = screen.getByLabelText("Property name") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "Edited" } });
  expect(input.closest('.aui-field-row--inline')).not.toBeNull();
  expect(view.container.querySelectorAll('.aui-inspector .aui-inspector')).toHaveLength(0);
  expect(screen.getByText('Property guidance').hidden).toBe(true);
  view.rerender(<WorkspaceShell preset="floating" {...props}>Canvas</WorkspaceShell>);
  expect((screen.getByLabelText("Property name") as HTMLInputElement).value).toBe("Edited");
  expect(screen.getByLabelText("Property name").closest('.aui-inspector')).not.toBeNull();
});

test("custom right-side content and collections retain their own layout", () => {
  const view = render(<WorkspaceShell preset="docked" panelSelection="multiple" rightPanels={[
    { id: "custom", title: "Custom", icon: "", contentLayout: "custom", content: <FieldRow label="Canvas field"><TextField aria-label="Custom field" /></FieldRow> },
    { id: "collection", title: "Collection", icon: "", collection: true, content: <div>Collection body</div> },
  ]} defaultOpenRight={["custom", "collection"]}>Canvas</WorkspaceShell>);
  expect(view.container.querySelectorAll('.aui-inspector')).toHaveLength(0);
  expect(screen.getByLabelText('Custom field').closest('.aui-field-row--inline')).toBeNull();
});

test("a pinned panel keeps its own column while another rail panel opens beside it", () => {
  const panels = [
    { id: "features", title: "Features", icon: <span />, content: <p>feature list</p> },
    { id: "comments", title: "Comments", icon: <span />, content: <p>comment list</p> },
  ];
  const Harness = () => {
    const [state, setState] = useState<WorkspacePanelState>({ features: { placement: "docked" }, comments: { placement: "hidden" } });
    return <WorkspaceShell preset="docked" leftPanels={panels} pinnedPanels={["features"]} panelState={state} onPanelStateChange={setState}><div /></WorkspaceShell>;
  };
  const { container } = render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Comments" }));
  expect(screen.getByText("feature list")).toBeTruthy();
  expect(screen.getByText("comment list")).toBeTruthy();
  expect(container.querySelector(".aui-shell-pinned")?.textContent).toContain("feature list");
  expect(container.querySelector(".aui-shell-pinned")?.textContent).not.toContain("comment list");
});

test("a pinned panel saved as floating returns to its column", () => {
  const panels = [{ id: "features", title: "Features", icon: <span />, content: <p>feature list</p> }];
  const { container } = render(<WorkspaceShell preset="docked" leftPanels={panels} pinnedPanels={["features"]}
    panelState={{ features: { placement: "floating" } }}><div /></WorkspaceShell>);
  expect(container.querySelector(".aui-float-panel")).toBeNull();
  expect(container.querySelector(".aui-shell-pinned")?.textContent).toContain("feature list");
});

test("side-column widgets stack in the floating column and sit at the canvas edge when docked", () => {
  const panels = [{ id: "props", title: "Properties", icon: <span />, content: <p>props</p> }];
  const view = render(<WorkspaceShell preset="floating" rightPanels={panels} sideTop={{ right: <i>cube</i> }} sideBottom={{ right: <i>filter</i> }}><div /></WorkspaceShell>);
  const column = view.container.querySelector(".aui-shell-fledge--right")!;
  expect(column.firstElementChild?.textContent).toBe("cube");
  expect(column.lastElementChild?.textContent).toBe("filter");
  view.rerender(<WorkspaceShell preset="docked" rightPanels={panels} sideTop={{ right: <i>cube</i> }} sideBottom={{ right: <i>filter</i> }}><div /></WorkspaceShell>);
  expect(view.container.querySelector(".aui-shell-center .aui-shell-edge-accessory--top")?.textContent).toBe("cube");
  expect(view.container.querySelector(".aui-shell-center .aui-shell-edge-accessory--bottom")?.textContent).toBe("filter");
});

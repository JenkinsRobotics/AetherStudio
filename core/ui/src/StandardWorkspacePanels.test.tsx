// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { standardWorkspacePanels, STANDARD_WORKSPACE_PANELS } from "./StandardWorkspacePanels";
import { WorkspaceShell } from "./WorkspaceShell";

afterEach(cleanup);
describe("standard document rail", () => {
  it("preserves product panel IDs, data and extras while fixing suite order and glyphs", () => {
    const content = <input aria-label="Feature name" defaultValue="Scene 1" />;
    const panels = standardWorkspacePanels([
      { id:"outputs",title:"Outputs",icon:null,content:"Output 1" },
      { id:"layers",title:"Layers",icon:null,collection:true,content },
      { id:"agent",title:"Agent",icon:null,content:"Connected advisor" },
      { id:"assets",title:"Assets",icon:null,content:"Library" },
    ], {features:"layers",advisor:"agent","part-manager":"assets"});
    expect(panels.map(p=>p.title)).toEqual([...STANDARD_WORKSPACE_PANELS.slice(0,-1).map(p=>p.title),"Outputs","Part manager"]);
    expect(panels[0]).toMatchObject({id:"layers",collection:true,content});
    expect(panels[6]).toMatchObject({id:"agent",content:"Connected advisor"});
    expect(panels.at(-1)).toMatchObject({id:"assets",separatorBefore:true,content:"Library"});
  });
  it("opens one panel at a time and restores mounted edits after changing tabs", () => {
    render(<WorkspaceShell preset="docked" inheritChromePreferences={false} preservePanelContent
      leftPanels={standardWorkspacePanels([{id:"features",title:"Tree",icon:null,content:<input aria-label="Feature name" defaultValue="Scene 1"/>}])}
      defaultOpenLeft={["features"]}><div>Canvas</div></WorkspaceShell>);
    const rail=screen.getByRole("toolbar",{name:"Left sidebar tabs"});
    fireEvent.change(screen.getByRole("textbox",{name:"Feature name"}),{target:{value:"Scene 2"}});
    fireEvent.click(within(rail).getByRole("button",{name:"Comments"}));
    expect(screen.getByText("Comments is not connected in this workspace yet.")).toBeTruthy();
    expect(within(rail).getAllByRole("button").filter(b=>b.getAttribute("aria-pressed")==="true")).toHaveLength(1);
    fireEvent.click(within(rail).getByRole("button",{name:"Features and parts"}));
    expect((screen.getByRole("textbox",{name:"Feature name"}) as HTMLInputElement).value).toBe("Scene 2");
  });
  it("rejects bindings that would create duplicate panel IDs", () => {
    expect(()=>standardWorkspacePanels([], {features:"same",advisor:"same"})).toThrow("Two standard workspace panels");
  });
});

it("Create version is a dialog command that preserves the active panel and its edits", async () => {
  const change = vi.fn();
  const connection = {key:"test",name:"Part",flush:async()=>{},reload:async()=>{},call:vi.fn().mockResolvedValue({branches:[{name:"Main",head_revision:1}],versions:[],revisions:[],comments:[],tasks:[],reminders:[],notes:{text:""},members:[],activity:[]})};
  render(<WorkspaceShell preset="docked" inheritChromePreferences={false} preservePanelContent onPanelStateChange={change}
    leftPanels={standardWorkspacePanels([{id:"features",title:"Tree",icon:null,content:<input aria-label="Feature name" defaultValue="Draft"/>}],{},connection)}
    defaultOpenLeft={["features"]}>Canvas</WorkspaceShell>);
  const rail=screen.getByRole("toolbar",{name:"Left sidebar tabs"});
  const features=within(rail).getByRole("button",{name:"Features and parts"});
  const create=within(rail).getByRole("button",{name:"Create version"});
  fireEvent.change(screen.getByLabelText("Feature name"),{target:{value:"Keep my draft"}});
  change.mockClear();
  fireEvent.click(create);
  const dialog=await screen.findByRole("dialog",{name:"Create version from Main"});
  expect(create.getAttribute("aria-haspopup")).toBe("dialog");
  expect(create.hasAttribute("aria-pressed")).toBe(false);
  expect(features.getAttribute("aria-pressed")).toBe("true");
  expect(within(dialog).getByRole("button",{name:"Create branch"})).toBeTruthy();
  expect(within(dialog).getByLabelText("Description")).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button",{name:"Cancel"}));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect((screen.getByLabelText("Feature name") as HTMLInputElement).value).toBe("Keep my draft");
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(features);
  change.mockClear();
  fireEvent.click(create);
  await screen.findByRole("dialog");
  expect(features.getAttribute("aria-pressed")).toBe("false");
  fireEvent.keyDown(document,{key:"Escape"});
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(change).not.toHaveBeenCalled();
});

it("migrates a saved Create version panel to Features without opening a modal", () => {
  render(<WorkspaceShell preset="docked" inheritChromePreferences={false}
    leftPanels={standardWorkspacePanels([{id:"features",title:"Tree",icon:null,content:"Existing features"}])}
    defaultOpenLeft={["create-version"]}>Canvas</WorkspaceShell>);
  const rail=screen.getByRole("toolbar",{name:"Left sidebar tabs"});
  expect(within(rail).getByRole("button",{name:"Features and parts"}).getAttribute("aria-pressed")).toBe("true");
  expect(within(rail).getByRole("button",{name:"Create version"}).hasAttribute("aria-pressed")).toBe(false);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByText("Existing features")).toBeTruthy();
});

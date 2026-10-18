import { useState } from "react";
import { cleanup,fireEvent,render,screen,within } from "@testing-library/react";
import { afterEach,expect,test,vi } from "vitest";
import { FeatureTree } from "./FeatureTree";
import { featureTreeActions, type FeatureTreeRequest } from "./feature-tree";
import { createFeatureTreeSample,SAMPLE_FEATURE_COMMANDS,updateFeatureTreeSample } from "../gallery/feature-tree-sample";

afterEach(cleanup);
function Sample(){const[state,set]=useState(createFeatureTreeSample),[selection,select]=useState<ReadonlySet<string>>(new Set());return <FeatureTree features={state.features} parts={state.parts} defaultGeometry={state.geometry} selectedIDs={selection} onSelect={ids=>select(new Set(ids))} rollbackIndex={state.rollback} availableCommands={SAMPLE_FEATURE_COMMANDS} onCommand={request=>set(current=>updateFeatureTreeSample(current,request,"new-id"))}/>;}
function row(label:string){return screen.getByText(label,{exact:true}).closest('[role="treeitem"]') as HTMLElement;}
function command(label:string,action:string){fireEvent.contextMenu(row(label),{clientX:20,clientY:50});fireEvent.click(screen.getByRole("menuitem",{name:action}));}

test("feature history has shared sections, type icons, hover visibility and separate state markers",()=>{
 const{container}=render(<Sample/>);
 for(const name of ["Default geometry","Origin","Top","Front","Right","Features (15)","Parts (1)"])expect(screen.getByText(name,{exact:true})).toBeTruthy();
 expect(within(row("Sketch 1")).getByRole("button",{name:"Show Sketch 1"})).toBeTruthy();
 expect(within(row("Revolve 1")).getByRole("button",{name:"Hide Revolve 1"})).toBeTruthy();
 expect(row("Shell 1").className).toContain("suppressed");expect(row("Shell 1").className).not.toContain("rolled-back");
 expect(row("Sketch 4").className).toContain("rolled-back");
 expect(container.querySelectorAll('.aui-feature-tree .aui-tool-icon').length).toBeGreaterThan(10);
});
test("shared menu changes hidden/suppressed states independently and preserves state on rollback",()=>{
 render(<Sample/>);command("Sketch 2","Hide");expect(within(row("Sketch 2")).getByRole("button",{name:"Show Sketch 2"})).toBeTruthy();
 command("Sketch 2","Suppress");expect(row("Sketch 2").className).toContain("suppressed");command("Revolve 1","Roll to here");expect(row("Fillet 3").className).toContain("rolled-back");
 command("Revolve 1","Roll to end");expect(row("Fillet 3").className).not.toContain("rolled-back");expect(row("Sketch 2").className).toContain("suppressed");
 command("Sketch 2","Unsuppress");expect(within(row("Sketch 2")).getByRole("button",{name:"Show Sketch 2"})).toBeTruthy();
});
test("inline rename, selected-row keyboard context and accessible reorder use the same commands",()=>{
 render(<Sample/>);fireEvent.click(row("Sketch 2"));fireEvent.keyDown(row("Sketch 2"),{key:"F2"});const input=screen.getByRole("textbox",{name:"Rename Sketch 2"});fireEvent.change(input,{target:{value:"Hub profile"}});fireEvent.keyDown(input,{key:"Enter"});
 fireEvent.keyDown(row("Hub profile"),{key:"F10",shiftKey:true});fireEvent.click(screen.getByRole("menuitem",{name:"Move up"}));
 const labels=within(screen.getByRole("tree",{name:"Features"})).getAllByRole("treeitem").map(el=>el.querySelector('.aui-tree-label')?.textContent);expect(labels.indexOf("Hub profile")).toBeLessThan(labels.indexOf("Shell 1"));
 fireEvent.keyDown(row("Hub profile"),{key:"Delete"});expect(screen.queryByText("Hub profile",{exact:true})).toBeNull();
});
test("rollback line keyboard and type search do not mutate feature state",()=>{
 render(<Sample/>);const bar=screen.getByText("Rollback: 14 of 15 features").closest('[role="treeitem"]')!;fireEvent.keyDown(bar,{key:"Home"});expect(row("Revolve 1").className).toContain("rolled-back");
 fireEvent.keyDown(screen.getByText("Rollback: 0 of 15 features").closest('[role="treeitem"]')!,{key:"End"});expect(row("Revolve 1").className).not.toContain("rolled-back");
 fireEvent.change(screen.getByRole("searchbox",{name:"Filter by name or type"}),{target:{value:"fillet"}});expect(screen.getByText("Fillet 3")).toBeTruthy();expect(screen.queryByText("Revolve 1")).toBeNull();
});
test("capabilities disable unsupported menu actions and protected default geometry cannot be renamed/deleted",()=>{
 const state=createFeatureTreeSample(),dispatch=vi.fn();render(<FeatureTree features={state.features} parts={state.parts} selectedIDs={new Set()} onSelect={()=>{}} onCommand={dispatch} availableCommands={["visibility"]}/>);
 fireEvent.contextMenu(row("Revolve 1"));expect(screen.getByRole("menuitem",{name:"Suppress"}).hasAttribute("disabled")).toBe(true);fireEvent.click(screen.getByRole("menuitem",{name:"Suppress"}));expect(dispatch).not.toHaveBeenCalled();fireEvent.keyDown(document,{key:"Escape"});
 fireEvent.contextMenu(row("Top"));expect(screen.queryByRole("menuitem",{name:"Delete"})).toBeNull();expect(screen.getByRole("menuitem",{name:/Rename/}).hasAttribute("disabled")).toBe(true);
});
test("application rejection is rechecked before dispatch, mixed selection cannot suppress parts",()=>{
 const state=createFeatureTreeSample();const selected=[state.features[1],state.parts[0]];
 const actions=featureTreeActions(state.features[1],{selected,features:state.features,available:SAMPLE_FEATURE_COMMANDS,canCommand:request=>request.command === "move"?"Dependency would follow its consumer":true});
 expect(actions.find(a=>a.item.id === "suppress")?.item.disabled).toBe(true);expect(actions.find(a=>a.item.id === "move-down")?.item.disabledReason).toBe("Not available for this selection.");
});
test("folder operations preserve IDs and rollback boundary; parts visibility stays independent",()=>{
 let state=createFeatureTreeSample();const apply=(request:FeatureTreeRequest)=>{state=updateFeatureTreeSample(state,request,"folder-1");};
 apply({command:"new-folder",ids:["feature-7","feature-8"]});expect(state.features.at(-1)?.children?.map(item=>item.id)).toEqual(["feature-7","feature-8"]);
 apply({command:"delete",ids:["folder-1"]});expect(state.features.some(item=>item.id === "feature-7")).toBe(true);
 apply({command:"visibility",ids:["sample-part"],value:false});expect(state.parts[0].hidden).toBe(true);expect(state.features.find(item=>item.id === "feature-2")?.hidden).toBe(false);
});

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ModelStudioAppDemo } from "../gallery/model-studio-apps/ModelStudioAppDemo";
import { freshStudy } from "../gallery/model-studio-apps/studies";
import { validateStudyItems } from "../gallery/model-studio-apps/study-file";
import { validateModelParts } from "../gallery/plasticity-studio/model-file";
import { initialParts, freshHistory, sceneReducer } from "../gallery/plasticity-studio/state";
import { parseDemoDocument, studyFilename } from "../gallery/demo-document/document";
import { demoDocumentMenu } from "../gallery/demo-document/menu";
const doc = (app="map") => ({format:"aether-ui-study",version:1,app,name:"Saved study",description:"A local document",workspaceName:"Lighting",workspaceDescription:"First pass",data:app==="model"?initialParts():freshStudy(app as "map")});
beforeEach(()=>{localStorage.clear();vi.stubGlobal("ResizeObserver",class{observe(){}disconnect(){}});vi.stubGlobal("URL",Object.assign(URL,{createObjectURL:vi.fn(()=>"blob:study"),revokeObjectURL:vi.fn()}));});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();localStorage.clear();});
const click=(name:string)=>fireEvent.click(screen.getByRole("button",{name}));
const menu=(name:string)=>{click("File menu");fireEvent.click(screen.getByRole("menuitem",{name:name==="Save document"?/^Save document/:name}));};
function upload(value:unknown){const file=new File([JSON.stringify(value)],"test.aetherstudy.json",{type:"application/json"});Object.defineProperty(file,"text",{value:async()=>JSON.stringify(value)});fireEvent.change(screen.getByLabelText("Open study file"),{target:{files:[file]}});}

test("standard menu follows the official CAD grouping and keeps demo commands last",()=>{
 const items=demoDocumentMenu({hasRecovery:true,openLabel:"Open study…",unitLabel:"pixels",demoItems:[{id:"reset",label:"Reset sample"}]});
 expect(items.map(i=>i.label)).toEqual(["Save document","Commit…","Recover…","Open study…","Import…","Document details…","Export…","Rename document…","Move to…","Restore deleted workspaces…","Copy workspace…","Update workspace…","Workspace units…","Workspace properties…","Print…","Copy document link","Close document","Reset sample"]);
 expect(items.find(i=>i.id==="reset")?.heading).toBe("Demo");
 for(const id of ["commit","move","restore","update","import","link","units"]){const item=items.find(i=>i.id===`file:${id}`)!;expect(item.disabled).toBe(true);expect(item.disabledReason).toBeTruthy();}
});
test("each app round-trips its own study and refuses wrong-app or malformed data",()=>{
 for(const app of ["sketch","map","io","model"]){const value=doc(app),validate=app==="model"?validateModelParts:(v:unknown)=>validateStudyItems(v,app as "map");expect(parseDemoDocument<unknown>(JSON.stringify(value),app,validate).data).toEqual(value.data);expect(()=>parseDemoDocument<unknown>(JSON.stringify({...value,app:"other"}),app,validate)).toThrow();}
 const value=doc();expect(()=>parseDemoDocument(JSON.stringify({...value,data:[...value.data,value.data[0]]}),"map",v=>validateStudyItems(v,"map"))).toThrow(/duplicate/);
 expect(()=>parseDemoDocument(JSON.stringify({...value,data:[{...value.data[0],id:"unknown"}]}),"map",v=>validateStudyItems(v,"map"))).toThrow(/geometry/);
 expect(()=>parseDemoDocument(JSON.stringify({...value,data:[{...value.data[0],opacity:200}]}),"map",v=>validateStudyItems(v,"map"))).toThrow();
 expect(()=>validateModelParts([{...initialParts()[0],transform:{position:[0,0,0],rotation:[0,0,0],scale:[0,0,0]}}])).toThrow();
 expect(studyFilename("Bad/name:test")).toBe("Badnametest.aetherstudy.json");
});
test("rename and workspace properties update all identity menus",()=>{
 render(<ModelStudioAppDemo app="map"/>);menu("Rename document…");fireEvent.change(screen.getByRole("textbox",{name:"Document name"}),{target:{value:"Evening pavilion"}});click("Apply");
 expect(screen.getByText("Evening pavilion.map")).toBeTruthy();
 menu("Workspace properties…");fireEvent.change(screen.getByRole("textbox",{name:"Workspace name"}),{target:{value:"Lighting pass"}});click("Apply");expect(screen.getByText("Lighting pass")).toBeTruthy();
 menu("Save document");expect(screen.getByRole("link",{name:"Evening pavilion.aetherstudy.json"})).toBeTruthy();expect(URL.createObjectURL).toHaveBeenCalled();
});
test("open validates before replacing edits and restores saved document properties",async()=>{
 const view=render(<ModelStudioAppDemo app="map"/>);const input=screen.getByRole("textbox",{name:"Position X"});fireEvent.input(input,{target:{value:"32"}});fireEvent.keyDown(input,{key:"Enter"});
 upload({...doc(),app:"io"});await waitFor(()=>expect(screen.getByRole("alert").textContent).toContain("this demo app"));expect(input).toHaveProperty("value","32");click("Done");
 upload(doc());await waitFor(()=>expect(screen.getByRole("dialog",{name:"Open study"})).toBeTruthy());expect(input).toHaveProperty("value","32");click("Cancel");expect(input).toHaveProperty("value","32");
 upload(doc());await waitFor(()=>expect(screen.getByRole("dialog",{name:"Open study"})).toBeTruthy());click("Open study");expect(screen.getByText("Saved study.map")).toBeTruthy();expect(view.container.querySelector('[data-item="left"]')?.getAttribute('transform')).toBe('translate(0 0)');expect(screen.getByText("Lighting")).toBeTruthy();
});
test("recovery survives reopening without being overwritten by initial sample data",async()=>{
 const saved=doc();saved.data[0]={...saved.data[0],x:73};localStorage.setItem("aether-ui-demo-recovery:map",JSON.stringify(saved));
 render(<ModelStudioAppDemo app="map"/>);menu("Recover…");click("Recover");expect(screen.getByRole("textbox",{name:"Position X"})).toHaveProperty("value","73");expect(screen.getByText("Saved study.map")).toBeTruthy();
});
test("Print calls the browser and Close preserves edits until explicit discard",()=>{
 const print=vi.spyOn(window,"print").mockImplementation(()=>{}),close=vi.fn();render(<ModelStudioAppDemo app="map" onExit={close}/>);menu("Print…");expect(print).toHaveBeenCalledOnce();
 menu("Rename document…");fireEvent.change(screen.getByRole("textbox",{name:"Document name"}),{target:{value:"Changed"}});click("Apply");menu("Close document");expect(close).not.toHaveBeenCalled();click("Cancel");menu("Close document");click("Close without saving");expect(close).toHaveBeenCalledOnce();
});
test("copy downloads separately and opening a model resets its old edit history",()=>{
 render(<ModelStudioAppDemo app="io"/>);menu("Copy workspace…");click("Create copy");expect(screen.getByRole("link",{name:/Copy of Orbit controller/})).toBeTruthy();expect(screen.getByText("Orbit controller.io")).toBeTruthy();
 const history=sceneReducer(freshHistory(),{type:"edit",parts:initialParts().slice(0,1)});const opened=sceneReducer(history,{type:"open",parts:initialParts().slice(0,2)});expect(opened.past).toEqual([]);expect(sceneReducer(opened,{type:"undo"}).present).toHaveLength(2);
});
test("all three menu triggers expose the same document actions",()=>{
 render(<ModelStudioAppDemo app="map"/>);
 for(const trigger of ["File menu","Document menu","Study file"]){click(trigger);expect(within(screen.getByRole("menu")).getByRole("menuitem",{name:"Document details…"})).toBeTruthy();fireEvent.keyDown(screen.getByRole("menu"),{key:"Escape"});}
});

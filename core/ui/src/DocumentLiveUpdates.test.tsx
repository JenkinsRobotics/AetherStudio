// @vitest-environment jsdom
import {afterEach, expect, test, vi} from "vitest";
import {act, cleanup, render, screen, fireEvent, waitFor} from "@testing-library/react";
import {DocumentVersionPanel} from "./DocumentVersionPanel";
import {DocumentCollaborationPanel} from "./DocumentCollaborationPanel";
import type {DocumentChange, DocumentConnection, DocumentHistory, DocumentCollaboration} from "./DocumentServices";
afterEach(cleanup);
const history = (name="Experiment"): DocumentHistory => ({writable:true,branch_identity:"stable",branches:[{name:"Main",head_revision:1},{id:"branch-a",name,head_revision:1}],versions:[],revisions:[]});
const notes = (revision=1,text="Original"): DocumentCollaboration => ({revision,actor:"owner",owner:"owner",members:[],comments:[],tasks:[],reminders:[],notes:{text},activity:[]});
function connection(call: DocumentConnection["call"]) {
 const listeners: ((event:DocumentChange)=>void)[] = [];
 const dispose=vi.fn();
 const c:DocumentConnection = {key:"map:file:Main",name:"Show",call,flush:vi.fn(async()=>{}),reload:vi.fn(async()=>{}),subscribeChanges:fn=>{listeners.push(fn);return dispose;}};
 return {c,dispose,send:(event:DocumentChange)=>act(()=>listeners.forEach(fn=>fn(event)))};
}
test("live history ignores older reads, retains version form input and never reloads the editor",async()=>{
 let finish!: (h:DocumentHistory)=>void;
 const call=vi.fn().mockImplementationOnce(()=>new Promise(r=>{finish=r;})).mockResolvedValue(history("Renamed"));
 const {c,send,dispose}=connection(call);
 const view=render(<DocumentVersionPanel connection={c}/>);
 send({kind:"state",writable:true});
 await screen.findByRole("button",{name:"Workspace Renamed"});
 await act(async()=>{finish(history("Old"));});
 expect(screen.queryByRole("button",{name:"Workspace Old"})).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"Create version"}));
 fireEvent.change(screen.getByLabelText("Name"),{target:{value:"My milestone"}});
 send({kind:"unavailable"});
 expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("My milestone");
 expect(screen.queryByRole("button",{name:"Workspace Renamed"})).toBeNull();
 send({kind:"state",writable:false});
 await screen.findByRole("button",{name:"Workspace Renamed"});
 expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("My milestone");
 expect(c.flush).not.toHaveBeenCalled(); expect(c.reload).not.toHaveBeenCalled();
 view.unmount(); expect(dispose).toHaveBeenCalled();
});
test("notes keep their draft and original save guard through disconnect and remote changes",async()=>{
 let saved=notes();
 const call=vi.fn(async(action:string,args?:Record<string,unknown>)=>{
  if(action==="collaboration_mutate") { expect(args?.expected_revision).toBe(1); throw Object.assign(new Error("Changed elsewhere"),{status:409}); }
  return structuredClone(saved);
 }) as DocumentConnection["call"];
 const {c,send}=connection(call);
 render(<DocumentCollaborationPanel connection={c} kind="notes"/>);
 await screen.findByText("Original");
 fireEvent.click(screen.getByRole("button",{name:"Edit document notes"}));
 fireEvent.change(screen.getByLabelText("Document notes text"),{target:{value:"Unsaved draft"}});
 send({kind:"unavailable"});
 expect((screen.getByLabelText("Document notes text") as HTMLTextAreaElement).value).toBe("Unsaved draft");
 saved=notes(2,"Other person's notes"); send({kind:"state",writable:true});
 await waitFor(()=>expect((screen.getByRole("button",{name:"Save notes"}) as HTMLButtonElement).disabled).toBe(false));
 expect((screen.getByLabelText("Document notes text") as HTMLTextAreaElement).value).toBe("Unsaved draft");
 fireEvent.click(screen.getByRole("button",{name:"Save notes"}));
 await screen.findByRole("group",{name:"Review conflicting edit"});
 expect(screen.getByText("Other person's notes")).toBeTruthy();
 expect(c.flush).not.toHaveBeenCalled(); expect(c.reload).not.toHaveBeenCalled();
});
test("revocation discards in-flight discussion reads and stale subscriptions after changing documents",async()=>{
 let resolve!: (v:DocumentCollaboration)=>void;
 const a=connection(vi.fn(()=>new Promise(r=>{resolve=r;})) as DocumentConnection["call"]);
 const view=render(<DocumentCollaborationPanel connection={a.c} kind="notes"/>);
 a.send({kind:"unavailable"});
 await act(async()=>{resolve(notes(1,"Private old notes"));});
 expect(screen.queryByText("Private old notes")).toBeNull();
 const b=connection(vi.fn(async()=>notes(1,"Second file")) as DocumentConnection["call"]);b.c.key="map:second:Main";
 view.rerender(<DocumentCollaborationPanel connection={b.c} kind="notes"/>);
 await screen.findByText("Second file");a.send({kind:"unavailable"});
 expect(screen.getByText("Second file")).toBeTruthy();expect(a.dispose).toHaveBeenCalledOnce();
});

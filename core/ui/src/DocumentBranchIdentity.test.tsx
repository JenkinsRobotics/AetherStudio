// @vitest-environment jsdom
import {afterEach, expect, test, vi} from "vitest";
import {cleanup, render, screen, fireEvent, waitFor} from "@testing-library/react";
import {DocumentVersionPanel} from "./DocumentVersionPanel";
import {documentHistoryGraph} from "./document-history-graph";
import {visibleHistory} from "./document-history-view";
import type {DocumentConnection, DocumentHistory} from "./DocumentServices";
afterEach(cleanup);
const id = `branch-${"a".repeat(64)}`, replacement = `branch-${"b".repeat(64)}`;
function history(): DocumentHistory {
 return {branch_identity:"stable",writable:true,branches:[{name:"Main",head_revision:1},{id,name:"Experiment",head_revision:2}],versions:[],revisions:[
 {revision:1,name:"Show",saved:1,author:"A",event:"create",note:"",branch:"Main",parent_revision:null,merge_parent_revision:null},
 {revision:2,name:"Show",saved:2,author:"A",event:"save",note:"",branch:"Experiment",branch_id:id,parent_revision:1,merge_parent_revision:null}]};
}
function connection(h:DocumentHistory):DocumentConnection {
 return {key:`map:file:${id}`,name:"Show",branch:id,flush:vi.fn(async()=>{}),reload:vi.fn(async()=>{}),call:vi.fn(async(action)=>structuredClone(action==="history"?h:{ok:true})) as DocumentConnection["call"]};
}
test("renamed and deleted branch lanes remain distinct when a name is reused",()=>{
 const h=history();h.branches[1]={id:replacement,name:"Experiment",head_revision:1};
 h.versions=[{name:"Kept",revision:2,message:"",branch:"Experiment",branch_id:id}];
 const graph=documentHistoryGraph(h), old=graph.find(v=>v.name==="Kept")!, current=graph.find(v=>v.id===`workspace:${replacement}`)!;
 expect(old.lane).not.toBe(current.lane);
 expect(visibleHistory(graph,h,replacement,"current",true,"")).not.toContain(old);
 h.branches[1].name="New name";
 expect(documentHistoryGraph(h).find(v=>v.id===current.id)?.name).toBe("New name");
});
test("create from a named branch guards Main while retaining the selected source revision",async()=>{
 const h=history(), c=connection(h);render(<DocumentVersionPanel connection={c} createOnly branchOnly/>);
 await waitFor(()=>expect(c.call).toHaveBeenCalledWith("history"));
 fireEvent.change(screen.getByLabelText("Name"),{target:{value:"Child"}});
 fireEvent.click(screen.getByRole("button",{name:"Create branch"}));
 await waitFor(()=>expect(c.call).toHaveBeenCalledWith("branch_create",expect.objectContaining({name:"Child",expected_revision:1,from_revision:2,operation_id:expect.any(String)})));
 const call=vi.mocked(c.call).mock.calls.find(v=>v[0]==="branch_create")!;
 expect(call[1]).not.toHaveProperty("branch");
});
test("rename and open use the selected workspace identity rather than its label",async()=>{
 const h=history(),c=connection(h);c.branch="Main";c.openBranch=vi.fn(async()=>{});
 const prompt=vi.spyOn(window,"prompt").mockReturnValue("Renamed");
 render(<DocumentVersionPanel connection={c}/>);
 const row=await screen.findByRole("button",{name:"Workspace Experiment"});
 fireEvent.doubleClick(row);await waitFor(()=>expect(c.openBranch).toHaveBeenCalledWith(id));
 fireEvent.contextMenu(row);fireEvent.click(await screen.findByText("Rename workspace"));
 await waitFor(()=>expect(c.call).toHaveBeenCalledWith("branch_rename",expect.objectContaining({branch:id,new_name:"Renamed",expected_revision:2})));
 expect(vi.mocked(c.call).mock.calls.find(v=>v[0]==="branch_rename")![1]).not.toHaveProperty("name");prompt.mockRestore();
});
test("lost acknowledgement retries the captured version command without flushing or adopting new guards",async()=>{
 const h=history(),c=connection(h),writes:Record<string,unknown>[]=[];
 c.call=vi.fn(async(action,data)=>{
  if(action==="history")return structuredClone(h);
  writes.push(structuredClone(data!));
  if(writes.length===1)throw Object.assign(new Error("Reply lost"),{detail:{code:"outcome_unknown"}});
  return {ok:true,revision:2,replayed:true};
 }) as DocumentConnection["call"];
 render(<DocumentVersionPanel connection={c} createOnly/>);
 await waitFor(()=>expect(c.call).toHaveBeenCalledWith("history"));
 fireEvent.change(screen.getByLabelText("Name"),{target:{value:"Original"}});
 fireEvent.click(screen.getByRole("button",{name:"Create version"}));
 await screen.findByRole("button",{name:"Retry original change"});
 h.branches[1].head_revision=9;
 fireEvent.change(screen.getByLabelText("Name"),{target:{value:"Changed draft"}});
 fireEvent.click(screen.getByRole("button",{name:"Retry original change"}));
 await waitFor(()=>expect(writes).toHaveLength(2));expect(writes[1]).toEqual(writes[0]);
 expect(c.flush).toHaveBeenCalledTimes(1);expect(writes[1].expected_revision).toBe(2);
});

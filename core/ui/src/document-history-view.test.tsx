import { expect, test } from "vitest";
import { documentHistoryGraph } from "./document-history-graph";
import { milestoneChanges, visibleHistory, visibleParents } from "./document-history-view";
import type { DocumentHistory } from "./DocumentServices";
const savedHistory=(count:number):DocumentHistory=>({branches:[{name:"Main",head_revision:count}],versions:[],revisions:Array.from({length:count},(_,i)=>({revision:i+1,name:"Show",author:"Designer",saved:1000+i,event:i?"save":"create",note:"",branch:"Main",parent_revision:i||null,merge_parent_revision:null})).reverse()});

test("branch filters use real ancestry and distinguish deleted workspaces",()=>{
  const h=savedHistory(6);
  h.revisions.find(s=>s.revision===4)!.branch="Experiment";
  h.revisions.find(s=>s.revision===4)!.parent_revision=2;
  h.revisions.find(s=>s.revision===5)!.branch="Deleted";
  h.revisions.find(s=>s.revision===5)!.parent_revision=2;
  h.revisions.find(s=>s.revision===6)!.parent_revision=3;
  h.branches.push({name:"Experiment",head_revision:4});
  h.versions=[{name:"Base",revision:2,message:"",branch:"Main"},{name:"Trial",revision:4,message:"",branch:"Experiment"},{name:"Old",revision:5,message:"",branch:"Deleted"}];
  const rows=documentHistoryGraph(h);
  expect(visibleHistory(rows,h,"Experiment","current",true,"").map(r=>r.name)).toEqual(["Experiment","Trial","Start"]);
  expect(visibleHistory(rows,h,"Experiment","parents",true,"").map(r=>r.name)).toContain("Base");
  expect(visibleHistory(rows,h,"Main","workspaces",true,"").map(r=>r.name)).not.toContain("Old");
  expect(visibleHistory(rows,h,"Main","all",true,"").map(r=>r.name)).toContain("Old");
  expect(visibleHistory(rows,h,"Main","current",true,"Trial").map(r=>r.name)).toEqual(["Trial"]);
});
test("expanded changes are bounded by milestones and never promoted into versions",()=>{
  const h=savedHistory(8); h.versions=[{name:"Review",revision:5,message:""}];
  const rows=documentHistoryGraph(h);
  expect(milestoneChanges(rows[0],h).map(s=>s.revision)).toEqual([8,7,6]);
  expect(milestoneChanges(rows[1],h).map(s=>s.revision)).toEqual([5,4,3,2]);
  expect(rows).toHaveLength(3);
});
test("hiding automatic checkpoints reconnects graph edges; hiding merge lines keeps branch ancestry",()=>{
  const h=savedHistory(5);
  h.revisions.find(s=>s.revision===4)!.branch="Trial";
  h.revisions.find(s=>s.revision===4)!.parent_revision=2;
  h.revisions.find(s=>s.revision===5)!.parent_revision=3;
  h.revisions.find(s=>s.revision===5)!.merge_parent_revision=4;
  h.branches.push({name:"Trial",head_revision:4});
  h.versions=[{name:"Base",revision:2,message:""},{name:"Fork",revision:4,message:"",branch:"Trial"},{name:"Merge",revision:5,message:"",origin:"automatic"}];
  const rows=documentHistoryGraph(h), shown=visibleHistory(rows,h,"Main","all",false,"");
  expect(shown.some(row=>row.name==="Merge")).toBe(false);
  const main=rows.find(r=>r.id==="workspace:Main")!;
  expect(visibleParents(main,rows,shown,true).sort()).toEqual(["version:Base","version:Fork"]);
  expect(visibleParents(main,rows,shown,false)).toEqual(["version:Base"]);
  expect(visibleParents(rows.find(r=>r.id==="version:Fork")!,rows,shown,false)).toEqual(["version:Base"]);
});
